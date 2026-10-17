import { errorMessage } from '@/shared/api/errors.ts'
import { USER_ROLE, FEATURED_PRIORITY } from '@/shared/domain/constants.ts'
import { LatestRequest } from '@/shared/async/LatestRequest.ts'
import type { PageDependencies } from '@/shared/ports.ts'
import type { AppRepository } from '../api/AppApiClient.ts'
import type { AppQuery, AppSummary } from '@/shared/domain/models.ts'
import { readonly, computed, reactive, ref } from 'vue'

/** 管理后台应用筛选、分页、详情选择和操作流程。 */
export class AdminAppManageController {
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
  /** 保存应用列表的内部状态。 */
  private readonly appsState = ref<AppSummary[]>([])
  /** 只读暴露当前应用列表。 */
  readonly apps = readonly(this.appsState)
  /** 保存当前选中应用的内部状态。 */
  private readonly selectedAppState = ref<AppSummary | null>(null)
  /** 只读暴露当前选中的应用。 */
  readonly selectedApp = readonly(this.selectedAppState)
  /** 保存详情弹窗的内部显示状态。 */
  private readonly showDetailsModalState = ref(false)
  /** 只读暴露详情弹窗的显示状态。 */
  readonly showDetailsModal = readonly(this.showDetailsModalState)
  /** 保存聊天历史列表的检索表单数据。 */
  readonly searchForm = reactive<AppQuery>({
    appName: '',
    cover: '',
    id: undefined,
    userId: undefined,
    priority: undefined,
    codeGenType: '',
    deployKey: '',
    initPrompt: '',
  })
  /** 记录当前用户是否拥有管理员权限。 */
  readonly isAdmin = computed(() => this.store.loginUser.userRole === USER_ROLE.ADMIN)
  /** 根据总记录数和每页数量计算总页数。 */
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalState.value / this.pageSize)),
  )

  /** 接收管理端应用管理控制器运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供页面级会话、路由和通知依赖。 */
    private readonly dependencies: PageDependencies,
    /** 提供控制器所需的后端接口操作。 */
    private readonly api: Pick<AppRepository, 'adminListVoByPage' | 'adminUpdate' | 'adminDelete'>,
  ) {}

  /** 加载管理端应用列表并更新分页状态。 */
  loadApps = async (): Promise<void> => {
    if (this.disposed) return
    const request = this.requests.begin()
    if (!this.isAdmin.value) {
      await this.router.replace('/')
      return
    }
    this.isLoadingState.value = true
    try {
      const response = await this.api.adminListVoByPage(
        {
          pageNum: this.currentPageState.value,
          pageSize: this.pageSize,
          id: this.searchForm.id || undefined,
          appName: this.searchForm.appName?.trim() || undefined,
          cover: this.searchForm.cover?.trim() || undefined,
          initPrompt: this.searchForm.initPrompt?.trim() || undefined,
          codeGenType: this.searchForm.codeGenType?.trim() || undefined,
          deployKey: this.searchForm.deployKey?.trim() || undefined,
          userId: this.searchForm.userId || undefined,
          priority: this.searchForm.priority == null ? undefined : Number(this.searchForm.priority),
          sortField: 'createTime',
          sortOrder: 'descend',
        },
        { signal: request.signal },
      )
      if (!request.isCurrent()) return
      this.appsState.value = response.data.data?.records || []
      this.totalState.value = response.data.data?.totalRow || 0
    } catch (error) {
      if (this.disposed) return
      if (!request.isCurrent()) return
      this.notify.error(errorMessage(error, '网络异常，应用列表加载失败'))
    } finally {
      if (request.isCurrent()) this.isLoadingState.value = false
    }
  }

  /** 应用当前检索条件并从第一页重新查询。 */
  search = async (): Promise<void> => {
    if (this.disposed) return
    this.currentPageState.value = 1
    await this.loadApps()
  }

  /** 清空应用筛选条件并重新加载第一页。 */
  reset = async (): Promise<void> => {
    if (this.disposed) return
    Object.assign(this.searchForm, {
      appName: '',
      cover: '',
      id: undefined,
      userId: undefined,
      priority: undefined,
      codeGenType: '',
      deployKey: '',
      initPrompt: '',
    })
    await this.search()
  }

  /** 切换列表页码并加载对应数据。 */
  changePage = async (page: number): Promise<void> => {
    if (this.disposed) return
    if (this.isLoadingState.value || page < 1 || page > this.totalPages.value) return
    this.currentPageState.value = page
    await this.loadApps()
  }

  /** 切换应用的精选展示状态。 */
  featureApp = async (app: AppSummary): Promise<void> => {
    if (this.disposed) return
    if (!app.id) return
    try {
      await this.api.adminUpdate({ id: app.id, priority: FEATURED_PRIORITY })
      if (this.disposed) return
      this.notify.success('应用已加入精选')
      await this.loadApps()
    } catch (error) {
      if (this.disposed) return
      this.notify.error(errorMessage(error, '网络异常，精选设置失败'))
    }
  }

  /** 删除当前应用并处理删除后的导航或刷新。 */
  removeApp = (app: AppSummary): void => {
    if (!app.id) return
    this.dependencies.confirm({
      title: '确认删除应用？',
      content: `删除后将无法恢复“${app.appName || '未命名应用'}”。`,
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => this.deleteApp(app),
    })
  }

  /** 打开指定聊天记录的详情视图。 */
  openDetails = (app: AppSummary): void => {
    this.selectedAppState.value = app
    this.showDetailsModalState.value = true
  }

  /** 导航到应用详情或聊天页面。 */
  openApp = (app: AppSummary): void => {
    if (app.id) void this.router.push(`/app/${app.id}`)
  }

  /** 打开应用编辑流程。 */
  editApp = (app: AppSummary): void => {
    if (app.id) void this.router.push(`/app/edit/${app.id}`)
  }

  /** 删除指定应用并同步更新列表。 */
  private deleteApp = async (app: AppSummary): Promise<void> => {
    if (this.disposed) return
    try {
      await this.api.adminDelete({ id: app.id })
      if (this.disposed) return
      this.notify.success('应用已删除')
      if (this.appsState.value.length === 1 && this.currentPageState.value > 1)
        this.currentPageState.value -= 1
      await this.loadApps()
    } catch (error) {
      if (this.disposed) return
      this.notify.error(errorMessage(error, '网络异常，应用删除失败'))
    }
  }

  /** 启动控制器所需的初始加载或监听。 */
  start = async (): Promise<void> => {
    if (this.disposed) return
    this.disposed = false
    await this.store.fetchLoginUser()
    await this.loadApps()
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
