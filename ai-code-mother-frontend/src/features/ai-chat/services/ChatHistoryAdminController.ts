import { errorMessage } from '@/shared/api/errors.ts'
import { USER_ROLE } from '@/shared/domain/constants.ts'
import { LatestRequest } from '@/shared/async/LatestRequest.ts'
import type { PageDependencies } from '@/shared/ports.ts'
import type { ChatHistoryRepository } from '../api/ChatHistoryApiClient.ts'
import type { ChatHistoryRecord } from '@/shared/domain/models.ts'
import { readonly, computed, reactive, ref } from 'vue'

/** 管理后台聊天历史筛选、分页、详情选择和导航。 */
export class ChatHistoryAdminController {
  /** 跟踪并取消过期请求，避免旧响应覆盖新状态。 */
  private readonly requests = new LatestRequest()
  /** 标记控制器是否已清理，阻止离页后继续更新状态。 */
  private disposed = false
  /** 提供当前应用的路由对象。 */
  get router() {
    return this.dependencies.router
  }
  /** 提供当前登录用户状态仓库。 */
  private get store() {
    return this.dependencies.session
  }
  /** 提供界面通知能力。 */
  private get notify() {
    return this.dependencies.notify
  }

  /** 保存列表数据的内部加载状态。 */
  private readonly isLoadingState = ref(false)
  /** 只读暴露列表数据是否正在加载。 */
  readonly isLoading = readonly(this.isLoadingState)
  /** 保存数据加载失败时的内部错误状态。 */
  private readonly loadErrorState = ref('')
  /** 只读暴露当前数据加载错误。 */
  readonly loadError = readonly(this.loadErrorState)
  /** 保存当前页码的内部状态。 */
  private readonly currentPageState = ref(1)
  /** 只读暴露当前页码。 */
  readonly currentPage = readonly(this.currentPageState)
  /** 保存每页最多显示的记录数量。 */
  readonly pageSize = 10
  /** 保存查询结果总数的内部状态。 */
  private readonly totalState = ref(0)
  /** 只读暴露当前查询结果总数。 */
  readonly total = readonly(this.totalState)
  /** 保存聊天历史列表的内部状态。 */
  private readonly historiesState = ref<ChatHistoryRecord[]>([])
  /** 只读暴露当前聊天历史列表。 */
  readonly histories = readonly(this.historiesState)
  /** 保存当前选中聊天记录的内部状态。 */
  private readonly selectedHistoryState = ref<ChatHistoryRecord | null>(null)
  /** 只读暴露当前选中的聊天记录。 */
  readonly selectedHistory = readonly(this.selectedHistoryState)
  /** 保存详情弹窗的内部显示状态。 */
  private readonly showDetailsModalState = ref(false)
  /** 只读暴露详情弹窗的显示状态。 */
  readonly showDetailsModal = readonly(this.showDetailsModalState)
  /** 保存聊天历史列表的检索表单数据。 */
  readonly searchForm = reactive({
    id: '',
    appId: '',
    userId: '',
    messageType: '',
    message: '',
  })
  /** 记录当前用户是否拥有管理员权限。 */
  readonly isAdmin = computed(() => this.store.loginUser.userRole === USER_ROLE.ADMIN)
  /** 根据总记录数和每页数量计算总页数。 */
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalState.value / this.pageSize)),
  )

  /** 接收管理端聊天历史控制器运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供页面级会话、路由和通知依赖。 */
    private readonly dependencies: PageDependencies,
    /** 提供控制器所需的后端接口操作。 */
    private readonly api: Pick<ChatHistoryRepository, 'listAdmin'>,
  ) {}

  /** 将消息类型转换为界面展示用的中文标签。 */
  getMessageTypeLabel = (type?: string): string =>
    type === 'user' ? '用户' : type === 'ai' ? 'AI' : type || '-'

  /** 加载当前筛选条件下的聊天历史并更新列表状态。 */
  loadHistories = async (): Promise<void> => {
    if (this.disposed) return
    const request = this.requests.begin()
    if (!this.isAdmin.value) {
      await this.router.replace('/')
      return
    }
    this.isLoadingState.value = true
    this.loadErrorState.value = ''
    try {
      const response = await this.api.listAdmin(
        {
          pageNum: this.currentPageState.value,
          pageSize: this.pageSize,
          id: this.searchForm.id.trim() || undefined,
          appId: this.searchForm.appId.trim() || undefined,
          userId: this.searchForm.userId.trim() || undefined,
          messageType: this.searchForm.messageType || undefined,
          message: this.searchForm.message.trim() || undefined,
          sortField: 'createTime',
          sortOrder: 'descend',
        },
        { signal: request.signal },
      )
      if (!request.isCurrent()) return
      this.historiesState.value = response.data.data?.records || []
      this.totalState.value = response.data.data?.totalRow || 0
    } catch (error) {
      if (!request.isCurrent()) return
      this.loadErrorState.value = errorMessage(error, '对话历史加载失败')
    } finally {
      if (request.isCurrent()) this.isLoadingState.value = false
    }
  }

  /** 应用当前检索条件并从第一页重新查询。 */
  search = async (): Promise<void> => {
    this.currentPageState.value = 1
    await this.loadHistories()
  }

  /** 清空历史筛选条件并重新加载第一页。 */
  reset = async (): Promise<void> => {
    Object.assign(this.searchForm, {
      id: '',
      appId: '',
      userId: '',
      messageType: '',
      message: '',
    })
    await this.search()
  }

  /** 切换列表页码并加载对应数据。 */
  changePage = async (page: number): Promise<void> => {
    if (this.isLoadingState.value || page < 1 || page > this.totalPages.value) return
    this.currentPageState.value = page
    await this.loadHistories()
  }

  /** 打开指定聊天记录的详情视图。 */
  openDetails = (history: ChatHistoryRecord): void => {
    this.selectedHistoryState.value = history
    this.showDetailsModalState.value = true
  }

  /** 导航到应用详情或聊天页面。 */
  openApp = (history: ChatHistoryRecord): void => {
    if (history.appId) void this.router.push(`/app/${history.appId}`)
  }

  /** 启动控制器所需的初始加载或监听。 */
  start = async (): Promise<void> => {
    this.disposed = false
    await this.store.fetchLoginUser()
    await this.loadHistories()
  }

  /** 取消未完成任务并释放控制器持有的资源。 */
  dispose = (): void => {
    this.disposed = true
    this.requests.cancel()
  }

  /** 设置聊天记录详情弹窗的显示状态。 */
  setDetailsOpen = (open: boolean): void => {
    this.showDetailsModalState.value = open
  }
}
