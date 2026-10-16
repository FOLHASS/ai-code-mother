/**
 * 应用对话的编排层：以路由应用 ID 为入口，统一持有应用详情、消息数组和权限派生值。
 * 分别组合历史、生成、预览、部署下载和可视化编辑模块，向页面暴露稳定的状态与操作。
 * 异步任务通过 appVersion 隔离应用切换，避免旧请求覆盖新会话；页面卸载同时取消生成流。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useRoute, useRouter } from 'vue-router'

import { adminGetAppVoById, getAppVoById } from '@/modules/app-management/api/appApi.ts'
import { useAppGeneration } from '@/modules/ai-chat/composables/useChatGeneration.ts'
import { useAppHistory } from '@/modules/ai-chat/composables/useChatHistory.ts'
import type { ChatMessage } from '@/modules/ai-chat/types/chatMessage.ts'
import { getAppAccessPolicy } from '@/modules/app-management/services/appPermissionPolicy.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'
import { getDeployUrl } from '@/utils/app.ts'
import { useAppActions } from '@/modules/app-management/services/appActions.ts'
import { usePreview } from '@/modules/preview-editor/composables/usePreview.ts'
import { useVisualEditor } from '@/modules/preview-editor/composables/useVisualEditor.ts'
import { asApiLongId } from '@/utils/id.ts'

/** 每次页面创建独立会话状态；无需将仅当前应用使用的临时状态放入全局 Store。 */
export function useAppChatSession() {
  const route = useRoute()
  const router = useRouter()
  const loginUserStore = useLoginUserStore()
  // 应用实体和消息数组只有此编排层创建，下游 composable 接收同一组 ref 协作更新。
  const app = ref<API.AppVO | null>(null)
  const messages = ref<ChatMessage[]>([])
  const isLoadingApp = ref(true)
  // DOM 引用由消息列表挂载事件回传，用于首屏滚底与向前加载历史时保持阅读位置。
  const messageList = ref<HTMLElement | null>(null)
  const setMessageList = (element: HTMLElement | null) => {
    messageList.value = element
  }
  // 自动初始化在当前应用会话中最多触发一次；应用切换后才重置。
  const hasSentInitialPrompt = ref(false)
  // 单调递增的会话版本供所有异步模块比对，失效任务不得再提交状态或提示错误。
  let appVersion = 0

  // 路由 ID 保持字符串，避免 Java Long / 雪花 ID 经 JavaScript number 丢失精度。
  const appId = computed(() => String(route.params.id || ''))
  const appTitle = computed(() => app.value?.appName || '未命名应用')
  const accessPolicy = computed(() =>
    getAppAccessPolicy(
      { id: loginUserStore.loginUser.id, role: loginUserStore.loginUser.userRole },
      { ownerId: app.value?.userId },
    ),
  )
  const isLoggedIn = computed(() => accessPolicy.value.isAuthenticated)
  // 编辑、生成、删除、部署和下载使用创建者权限；管理员只额外获得历史查看权限。
  const isOwner = computed(() => accessPolicy.value.isOwner)
  const canInteract = computed(() => accessPolicy.value.canInteract)
  // 读取历史和修改应用是两个独立能力，不能因管理员可看历史而放开其他用户作品的编辑。
  const canReadHistory = computed(() => accessPolicy.value.canReadHistory)
  const userMessageLabel = computed(() =>
    isOwner.value ? '你' : app.value?.user?.userName || '用户',
  )

  // 预览模块自行检测静态文件就绪，不以消息条数直接认定构建成功。
  const { previewUrl, previewError, hasGeneratedWebsite, showPreview, resetPreview } =
    usePreview(app, () => appVersion)

  /** 等待消息渲染后滚至底部；流式更新是否跟随滚动由生成模块根据用户阅读位置决定。 */
  const scrollToBottom = async () => {
    await nextTick()
    if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
  }

  // 历史模块只管理游标和加载过程；合并结果写回同一个 messages 数组。
  const {
    isLoadingHistory,
    historyLoaded,
    historyError,
    hasMoreHistory,
    historyTotal,
    resetHistory,
    loadHistory,
  } = useAppHistory({
    app,
    canReadHistory,
    messages,
    messageList,
    showPreview,
    scrollToBottom,
    getVersion: () => appVersion,
  })

  // 可视化编辑仅追加发送给后端的定位上下文，聊天气泡继续显示用户输入的原文。
  const visualEditor = useVisualEditor(previewUrl)
  const { input, isStreaming, resetGeneration, sendMessage } = useAppGeneration({
    app,
    canInteract,
    historyLoaded,
    isLoadingHistory,
    messages,
    messageList,
    showPreview,
    scrollToBottom,
    getVersion: () => appVersion,
    prepareMessage: visualEditor.prepareMessage,
    onMessageSent: visualEditor.resetVisualEditor,
  })
  // 编辑按钮的可用性来自权限、历史就绪和真实预览状态，生成期间同步退出编辑。
  const canVisualEdit = computed(
    () =>
      canInteract.value &&
      historyLoaded.value &&
      hasGeneratedWebsite.value &&
      Boolean(previewUrl.value) &&
      !isLoadingApp.value &&
      !isStreaming.value,
  )
  // 使用同步观察在禁用条件出现时立即清理选中元素，防止旧定位信息混入下一条提示词。
  watch(
    canVisualEdit,
    (available) => {
      if (!available) visualEditor.resetVisualEditor()
    },
    { flush: 'sync' },
  )
  /** UI 禁用之外再做一次状态校验，避免程序调用或临界切换绕过编辑可用条件。 */
  const toggleEditMode = () => {
    if (canVisualEdit.value) visualEditor.toggleEditMode()
  }
  const {
    isDeploying,
    isDownloading,
    deployedUrl,
    resetActions,
    handleDeploy,
    handleDownload,
    openDeployUrl,
  } = useAppActions({ app, appId, canInteract, isStreaming, getVersion: () => appVersion })

  /**
   * 先读取服务端最新历史，再决定是否发送初始提示词。
   * 只有创建者、历史总数为零、当前消息为空、未自动发送且 initPrompt 非空时才初始化。
   * 读取失败不能视为“没有历史”，避免失败重试或浏览别人作品时误触发生成。
   */
  const initializeHistory = async (version = appVersion) => {
    const loaded = await loadHistory(false, version)
    if (!loaded || version !== appVersion) return
    if (
      isOwner.value &&
      historyTotal.value === 0 &&
      !messages.value.length &&
      !hasSentInitialPrompt.value &&
      app.value?.initPrompt?.trim()
    ) {
      // 在等待网络之前标记，确保同一会话的重复初始化不会发送相同的初始请求。
      hasSentInitialPrompt.value = true
      isLoadingApp.value = false
      await sendMessage(app.value.initPrompt, true)
    }
  }

  // 首次读取失败走完整初始化；已成功加载过则沿当前游标继续补充旧记录。
  const retryHistory = () => (historyLoaded.value ? loadHistory(true) : initializeHistory())

  /**
   * 路由首次加载与应用切换的统一入口。先使所有旧任务失效，再清空应用关联的临时状态。
   * 详情成功后按权限选择“加载历史”或“只读预览”，不再依赖旧链接中的 view/prompt 参数。
   */
  const loadApp = async () => {
    // 先递增版本再 abort 旧生成：即使旧任务进入 finally，也不能改变新应用的加载状态。
    const version = ++appVersion
    visualEditor.resetVisualEditor()
    resetGeneration()
    app.value = null
    messages.value = []
    resetPreview()
    resetActions()
    hasSentInitialPrompt.value = false
    resetHistory()
    if (!appId.value) {
      await router.replace('/')
      return
    }
    isLoadingApp.value = true
    try {
      // 清理旧链接参数，初始化条件完全由服务端历史记录决定。
      if (Object.hasOwn(route.query, 'view') || Object.hasOwn(route.query, 'prompt')) {
        const query = { ...route.query }
        delete query.view
        delete query.prompt
        await router.replace({ path: route.path, query })
      }
      if (version !== appVersion) return
      // 管理员详情接口与普通详情接口保持现有权限边界，请求前后都用版本阻止跨应用写入。
      const response =
        loginUserStore.loginUser.userRole === 'admin'
          ? await adminGetAppVoById({ id: asApiLongId(appId.value) })
          : await getAppVoById({ id: asApiLongId(appId.value) })
      if (version !== appVersion) return
      if (response.data.code !== 0 || !response.data.data) {
        message.error(response.data.message || '应用不存在或无权访问')
        await router.replace('/')
        return
      }
      // 详情接口中的 user 用于作者展示；部署地址与生成文件预览地址保持各自独立。
      app.value = response.data.data
      deployedUrl.value = getDeployUrl(app.value)
      if (canReadHistory.value) await initializeHistory(version)
      else await showPreview()
    } catch {
      if (version !== appVersion) return
      message.error('应用加载失败，请稍后重试')
      await router.replace('/')
    } finally {
      if (version === appVersion) isLoadingApp.value = false
    }
  }

  // 先恢复登录态，再计算创建者/管理员权限并加载应用，避免刷新页面时使用未初始化身份。
  onMounted(async () => {
    await loginUserStore.fetchLoginUser()
    await loadApp()
  })

  // 同一页面组件被不同应用 ID 复用时，不依赖重新挂载，也会执行完整重置与加载。
  watch(appId, () => void loadApp())

  // 退出页面后使未完成的详情/历史/预览请求失效，并主动中止仍在读取的 SSE 流。
  onUnmounted(() => {
    appVersion += 1
    resetGeneration()
    resetHistory()
    resetPreview()
    resetActions()
    visualEditor.resetVisualEditor()
  })

  // 页面只消费编排层公开接口；子模块的内部游标、AbortController 和编辑器实例保持封装。
  return {
    router,
    app,
    messages,
    input,
    isEditMode: visualEditor.isEditMode,
    selectedElement: visualEditor.selectedElement,
    setPreviewIframe: visualEditor.setPreviewIframe,
    clearSelection: visualEditor.clearSelection,
    canVisualEdit,
    toggleEditMode,
    isLoadingApp,
    isStreaming,
    isDeploying,
    isDownloading,
    previewUrl,
    previewError,
    deployedUrl,
    setMessageList,
    hasGeneratedWebsite,
    isLoadingHistory,
    historyLoaded,
    historyError,
    hasMoreHistory,
    appTitle,
    isLoggedIn,
    canInteract,
    canReadHistory,
    userMessageLabel,
    showPreview,
    loadHistory,
    retryHistory,
    sendMessage,
    handleDeploy,
    handleDownload,
    openDeployUrl,
  }
}

/** Compatibility alias for callers that still use the old page-level name. */
export const useAppChat = useAppChatSession
