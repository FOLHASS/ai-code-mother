import { computed, readonly, ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { PageDependencies } from '@/shared/ports.ts'
import type { AppSummary } from '@/shared/domain/models.ts'
import { USER_ROLE } from '@/shared/domain/constants.ts'
import { LatestRequest } from '@/shared/async/LatestRequest.ts'
import { errorMessage } from '@/shared/api/errors.ts'
import {
  ChatTimeline,
  ChatGenerationService,
  ChatHistoryService,
  type ChatStreamPort,
  type ChatHistoryRepository,
} from '@/features/ai-chat'
import {
  AppActionService,
  appPermissionPolicy,
  type AppRepository,
} from '@/features/app-management'
import {
  PreviewService,
  type PreviewRepository,
  type VisualEditorController,
} from '@/features/preview-editor'
import type { ArchiveResponse } from '@/shared/ui/downloadArchive.ts'
import { getDeployUrl } from '@/utils/app.ts'
import { ChatScrollController } from './ChatScrollController.ts'

export type AppChatSessionDependencies = {
  route: Pick<RouteLocationNormalizedLoaded, 'params' | 'query' | 'path'>
  page: PageDependencies
  apps: AppRepository
  history: ChatHistoryRepository
  stream: ChatStreamPort
  preview: PreviewRepository
  editor: VisualEditorController
  saveArchive: (response: ArchiveResponse, name: string) => Promise<void>
  openUrl: (url: string) => void
}

/** 协调应用聊天、历史记录、生成、预览和部署状态。 */
export class AppChatSessionController {
  /** 保存应用的内部响应状态。 */
  private readonly appState = ref<AppSummary | null>(null)
  /** 记录历史记录是否正在加载。 */
  private readonly loading = ref(true)
  /** 管理聊天消息时间线及消息合并。 */
  private readonly timeline = new ChatTimeline()
  /** 管理聊天消息列表的滚动位置。 */
  private readonly scroll = new ChatScrollController()
  /** 跟踪当前应用详情请求并取消过期请求。 */
  private readonly appRequest = new LatestRequest()
  /** 用递增版本号识别并忽略过期请求结果。 */
  private version = 0
  /** 标记控制器是否已清理，阻止离页后继续更新状态。 */
  private disposed = false
  /** 标记创建应用时的首条提示词是否已发送。 */
  private initialPromptSent = false
  /** 保存当前正在编辑或操作的应用数据。 */
  readonly app = readonly(this.appState)
  /** 只读暴露按时间排列的聊天消息。 */
  readonly messages = this.timeline.messages
  /** 只读暴露应用详情是否正在加载。 */
  readonly isLoadingApp = readonly(this.loading)
  /** 保存当前路由中的应用 ID。 */
  readonly appId = computed(() => String(this.dependencies.route.params.id || ''))
  /** 只读暴露当前应用标题。 */
  readonly appTitle = computed(() => this.appState.value?.appName || '未命名应用')
  /** 只读暴露当前用户在应用上的权限集合。 */
  readonly permissions = computed(() => {
    const user = this.dependencies.page.session.loginUser
    return appPermissionPolicy.evaluate(
      { id: user.id, role: user.userRole },
      { ownerId: this.appState.value?.userId },
    )
  })
  /** 只读暴露当前用户是否已登录。 */
  readonly isLoggedIn = computed(() => this.permissions.value.isAuthenticated)
  /** 只读暴露当前用户是否为应用所有者。 */
  readonly isOwner = computed(() => this.permissions.value.isOwner)
  /** 只读暴露当前用户是否可以发送消息。 */
  readonly canInteract = computed(() => this.permissions.value.canGenerate)
  /** 只读暴露当前用户是否可以读取聊天历史。 */
  readonly canReadHistory = computed(() => this.permissions.value.canReadHistory)
  /** 只读暴露聊天消息中展示的用户名称。 */
  readonly userMessageLabel = computed(() =>
    this.isOwner.value ? '你' : this.appState.value?.user?.userName || '用户',
  )
  /** 只读暴露当前用户是否可以编辑预览页面。 */
  readonly canVisualEdit = computed(
    () =>
      this.canInteract.value &&
      this.history.historyLoaded.value &&
      this.preview.hasGeneratedWebsite.value &&
      this.dependencies.editor.isReady.value &&
      !this.loading.value &&
      !this.generation.isStreaming.value,
  )
  /** 提供网站预览资源查询能力。 */
  private readonly preview: PreviewService
  /** 提供聊天历史查询能力。 */
  private readonly history: ChatHistoryService
  /** 提供聊天生成操作及其状态。 */
  private readonly generation: ChatGenerationService
  /** 提供应用部署、下载和打开等操作。 */
  private readonly actions: AppActionService

  /** 接收应用聊天会话控制器运行所需的依赖并初始化状态。 */
  constructor(/** 提供页面级会话、路由和通知依赖。 */
  private readonly dependencies: AppChatSessionDependencies) {
    const getVersion = () => this.version
    this.preview = new PreviewService(this.appState, getVersion, dependencies.preview)
    this.history = new ChatHistoryService(
      { app: this.appState, canReadHistory: this.canReadHistory, getVersion },
      dependencies.history,
    )
    this.generation = new ChatGenerationService(
      {
        app: this.appState,
        canInteract: this.canInteract,
        historyLoaded: this.history.historyLoaded,
        getVersion,
        prepareMessage: dependencies.editor.prepareMessage,
        onMessageSent: () => {
          dependencies.editor.reset()
          void this.scroll.bottom(true)
        },
        onUpdated: () => {
          void this.scroll.bottom()
        },
        onCompleted: () => {
          void this.preview.show(true)
        },
        onError: (error) => dependencies.page.notify.error(errorMessage(error)),
      },
      dependencies.stream,
      this.timeline,
    )
    this.actions = new AppActionService(
      {
        app: this.appState,
        getVersion,
        canDeploy: computed(() => this.permissions.value.canDeploy),
        canDownload: computed(() => this.permissions.value.canDownload),
        isStreaming: this.generation.isStreaming,
      },
      dependencies.apps,
      dependencies.page.notify,
      dependencies.saveArchive,
      dependencies.openUrl,
    )
  }

  /** 提供当前应用的路由对象。 */
  get router() {
    return this.dependencies.page.router
  }
  /** 暴露当前聊天输入提示词。 */
  get input() {
    return this.generation.input
  }
  /** 暴露聊天回复是否仍在生成。 */
  get isStreaming() {
    return this.generation.isStreaming
  }
  /** 暴露应用部署是否正在执行。 */
  get isDeploying() {
    return this.actions.isDeploying
  }
  /** 暴露应用代码下载是否正在执行。 */
  get isDownloading() {
    return this.actions.isDownloading
  }
  /** 暴露最近一次部署成功返回的地址。 */
  get deployedUrl() {
    return this.actions.deployedUrl
  }
  /** 暴露当前网站预览地址。 */
  get previewUrl() {
    return this.preview.previewUrl
  }
  /** 暴露网站预览失败时的错误信息。 */
  get previewError() {
    return this.preview.previewError
  }
  /** 暴露预览就绪检查是否正在执行。 */
  get isCheckingPreview() {
    return this.preview.isChecking
  }
  /** 暴露当前应用是否已有可预览的网站。 */
  get hasGeneratedWebsite() {
    return this.preview.hasGeneratedWebsite
  }
  /** 暴露聊天历史是否已完成初始化。 */
  get historyLoaded() {
    return this.history.historyLoaded
  }
  /** 暴露聊天历史是否正在加载。 */
  get isLoadingHistory() {
    return this.history.isLoadingHistory
  }
  /** 暴露聊天历史加载失败信息。 */
  get historyError() {
    return this.history.historyError
  }
  /** 暴露是否还有更早的聊天记录可加载。 */
  get hasMoreHistory() {
    return this.history.hasMoreHistory
  }
  /** 暴露预览页面是否处于可视化编辑模式。 */
  get isEditMode() {
    return this.dependencies.editor.isEditMode
  }
  /** 暴露预览页面当前选中的元素信息。 */
  get selectedElement() {
    return this.dependencies.editor.selectedElement
  }

  /** 绑定聊天消息列表的滚动容器。 */
  setMessageList = this.scroll.attach
  /** 注册预览 iframe，供可视化编辑器建立通信。 */
  setPreviewIframe = (iframe: HTMLIFrameElement | null): void =>
    this.dependencies.editor.setPreviewIframe(iframe)
  /** 清除当前选中元素及其编辑提示信息。 */
  clearSelection = (): void => this.dependencies.editor.clearSelection()
  /** 关闭可视化编辑并清空编辑器的临时状态。 */
  resetEditor = (): void => this.dependencies.editor.reset()
  /** 刷新并显示当前应用的预览页面。 */
  showPreview = (cacheBust = false): Promise<void> => this.preview.show(cacheBust)
  /** 提交用户提示词并处理聊天生成过程。 */
  sendMessage = (value?: string): Promise<void> => this.generation.send(value)
  /** 执行应用部署并反馈操作结果。 */
  handleDeploy = (): Promise<void> => this.actions.deploy()
  /** 执行应用代码下载并反馈操作结果。 */
  handleDownload = (): Promise<void> => this.actions.download()
  /** 打开应用最近一次部署成功的地址。 */
  openDeployUrl = (): void => this.actions.openDeployed()
  /** 切换预览页面的可视化编辑模式。 */
  toggleEditMode = (): void => {
    if (this.canVisualEdit.value) this.dependencies.editor.toggleEditMode()
  }

  /** 启动控制器所需的初始加载或监听。 */
  start = async (): Promise<void> => {
    this.disposed = false
    await this.dependencies.page.session.fetchLoginUser()
    if (!this.disposed) await this.loadApp()
  }
  /** 按当前会话游标加载一页聊天历史。 */
  loadHistory = async (loadMore = false): Promise<boolean> => {
    const version = this.version
    const restore = this.scroll.captureAnchor()
    const page = await this.history.load(loadMore, version)
    if (!page || version !== this.version) return false
    this.timeline.mergeHistory(page.records, loadMore)
    if (loadMore) await restore()
    else {
      void this.scroll.bottom(true)
      if (page.total >= 2) void this.preview.show()
    }
    return true
  }
  /** 重新尝试加载上一轮失败的聊天历史。 */
  retryHistory = async (): Promise<void> => {
    if (this.history.historyLoaded.value) await this.loadHistory(true)
    else await this.initializeHistory()
  }

  /** 初始化聊天历史状态并加载首批记录。 */
  private initializeHistory = async (): Promise<void> => {
    const version = this.version
    if (!(await this.loadHistory()) || version !== this.version) return
    const prompt = this.appState.value?.initPrompt?.trim()
    if (
      this.isOwner.value &&
      this.history.historyTotal.value === 0 &&
      !this.messages.value.length &&
      !this.initialPromptSent &&
      prompt
    ) {
      this.initialPromptSent = true
      this.loading.value = false
      await this.generation.send(prompt, true)
    }
  }

  /** 读取当前路由对应的应用信息。 */
  loadApp = async (): Promise<void> => {
    if (this.disposed) return
    const request = this.appRequest.begin()
    const version = ++this.version
    this.generation.reset()
    this.history.reset()
    this.preview.reset()
    this.actions.reset()
    this.dependencies.editor.reset()
    this.scroll.reset()
    this.timeline.reset()
    this.appState.value = null
    this.initialPromptSent = false
    this.loading.value = true
    const id = this.appId.value
    if (!id) {
      await this.router.replace('/')
      return
    }
    try {
      const route = this.dependencies.route
      if (Object.hasOwn(route.query, 'view') || Object.hasOwn(route.query, 'prompt')) {
        const query = { ...route.query }
        delete query.view
        delete query.prompt
        await this.router.replace({ path: route.path, query })
      }
      if (!request.isCurrent()) return
      const admin = this.dependencies.page.session.loginUser.userRole === USER_ROLE.ADMIN
      const response = await (
        admin ? this.dependencies.apps.adminGetVoById : this.dependencies.apps.getVoById
      )({ id }, { signal: request.signal })
      if (!request.isCurrent()) return
      this.appState.value = response.data.data
      this.actions.setDeployedUrl(getDeployUrl(response.data.data))
      if (this.canReadHistory.value) await this.initializeHistory()
      else void this.preview.show()
    } catch (error) {
      if (!request.isCurrent()) return
      this.dependencies.page.notify.error(errorMessage(error, '应用加载失败'))
      await this.router.replace('/')
    } finally {
      if (version === this.version) this.loading.value = false
    }
  }

  /** 删除当前应用并处理删除后的导航或刷新。 */
  removeApp = (): void => {
    const app = this.appState.value
    if (!app || !this.permissions.value.canDelete || this.generation.isStreaming.value) return
    const version = this.version
    this.dependencies.page.confirm({
      title: '删除这个应用？',
      content: `删除后将无法恢复“${app.appName || '未命名应用'}”。`,
      onOk: async () => {
        try {
          await this.dependencies.apps.delete({ id: app.id })
          if (version !== this.version) return
          this.dependencies.page.notify.success('应用已删除')
          await this.router.replace('/')
        } catch (error) {
          if (version === this.version) this.dependencies.page.notify.error(errorMessage(error))
        }
      },
    })
  }
  /** 取消未完成任务并释放控制器持有的资源。 */
  dispose = (): void => {
    this.disposed = true
    this.version += 1
    this.appRequest.cancel()
    this.generation.reset()
    this.history.reset()
    this.preview.reset()
    this.actions.reset()
    this.dependencies.editor.destroy()
    this.scroll.dispose()
  }
}
