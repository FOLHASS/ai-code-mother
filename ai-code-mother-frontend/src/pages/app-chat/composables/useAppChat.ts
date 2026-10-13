import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useRoute, useRouter } from 'vue-router'

import { adminGetAppVoById, getAppVoById } from '@/api/appController.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'
import { getDeployUrl } from '@/utils/app.ts'
import { useAppPreview } from './useAppPreview.ts'
import { useAppActions } from './useAppActions.ts'
import { useAppHistory } from './useAppHistory.ts'
import { useAppGeneration } from './useAppGeneration.ts'
import type { ChatMessage } from '@/utils/chatHistory.ts'
import { asApiLongId } from '@/utils/id.ts'

export function useAppChat() {
  const route = useRoute()
  const router = useRouter()
  const loginUserStore = useLoginUserStore()
  const app = ref<API.AppVO | null>(null)
  const messages = ref<ChatMessage[]>([])
  const isLoadingApp = ref(true)
  const messageList = ref<HTMLElement | null>(null)
  const setMessageList = (element: HTMLElement | null) => { messageList.value = element }
  const hasSentInitialPrompt = ref(false)
  let appVersion = 0

  const appId = computed(() => String(route.params.id || ''))
  const appTitle = computed(() => app.value?.appName || '未命名应用')
  const isLoggedIn = computed(() => Boolean(loginUserStore.loginUser.id))
  const isOwner = computed(() =>
    Boolean(
      isLoggedIn.value &&
      app.value?.userId &&
      String(app.value.userId) === String(loginUserStore.loginUser.id),
    ),
  )
  const canInteract = computed(() => isOwner.value)
  const canReadHistory = computed(
    () => isOwner.value || loginUserStore.loginUser.userRole === 'admin',
  )
  const userMessageLabel = computed(() =>
    isOwner.value ? '你' : app.value?.user?.userName || '用户',
  )

  const { previewUrl, previewError, hasGeneratedWebsite, showPreview, resetPreview } =
    useAppPreview(app, () => appVersion)

  const scrollToBottom = async () => {
    await nextTick()
    if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
  }

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
  })
  const {
    isDeploying,
    isDownloading,
    deployedUrl,
    resetActions,
    handleDeploy,
    handleDownload,
    openDeployUrl,
  } = useAppActions({ app, appId, canInteract, isStreaming, getVersion: () => appVersion })

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
      hasSentInitialPrompt.value = true
      isLoadingApp.value = false
      await sendMessage(app.value.initPrompt, true)
    }
  }

  const retryHistory = () => (historyLoaded.value ? loadHistory(true) : initializeHistory())

  const loadApp = async () => {
    const version = ++appVersion
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

  onMounted(async () => {
    await loginUserStore.fetchLoginUser()
    await loadApp()
  })

  watch(appId, () => void loadApp())

  onUnmounted(() => {
    appVersion += 1
    resetGeneration()
  })

  return {
    router,
    app,
    messages,
    input,
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
