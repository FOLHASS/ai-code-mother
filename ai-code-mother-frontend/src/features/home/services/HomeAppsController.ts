import { errorMessage } from '@/shared/api/errors.ts'
import { LatestRequest } from '@/shared/async/LatestRequest.ts'
import type { PageDependencies } from '@/shared/ports.ts'
import type { AppRepository } from '@/features/app-management'
import type { AppSummary } from '@/shared/domain/models.ts'
import { readonly, computed, ref } from 'vue'

/**
 * 控制我的作品和精选案例等部分
 * 1. 提供数据的初始化
 * 2. 数据分页字段的维护
 * 3. 精选案例部分的搜索
 * 4.
 */
export class HomeAppsController {
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

  /** 只读暴露当前用户是否已登录。 */
  readonly isLoggedIn = computed(() => Boolean(this.store.loginUser.id))

  /** 保存是否my加载的内部响应状态。 */
  private readonly isMyLoadingState = ref(false)
  /** 只读暴露个人应用列表是否正在加载。 */
  readonly isMyLoading = readonly(this.isMyLoadingState)
  /** 保存精选应用列表的内部加载状态。 */
  private readonly isGoodLoadingState = ref(false)
  /** 只读暴露精选应用列表是否正在加载。 */
  readonly isGoodLoading = readonly(this.isGoodLoadingState)
  /** 保存my应用的内部响应状态。 */
  private readonly myAppsState = ref<AppSummary[]>([])
  /** 只读暴露当前用户的应用列表。 */
  readonly myApps = readonly(this.myAppsState)
  /** 保存首页精选应用列表的内部状态。 */
  private readonly goodAppsState = ref<AppSummary[]>([])
  /** 只读暴露首页精选应用列表。 */
  readonly goodApps = readonly(this.goodAppsState)
  /** 保存my总数的内部响应状态。 */
  private readonly myTotalState = ref(0)
  /** 只读暴露当前用户应用总数。 */
  readonly myTotal = readonly(this.myTotalState)
  /** 保存精选应用总数的内部状态。 */
  private readonly goodTotalState = ref(0)
  /** 只读暴露精选应用总数。 */
  readonly goodTotal = readonly(this.goodTotalState)
  /** 保存my页码的内部响应状态。 */
  private readonly myPageState = ref(1)
  /** 保存当前用户应用列表页码。 */
  readonly myPage = readonly(this.myPageState)
  /** 保存精选应用页码的内部状态。 */
  private readonly goodPageState = ref(1)
  /** 保存精选应用列表页码。 */
  readonly goodPage = readonly(this.goodPageState)
  /** 保存每页最多显示的记录数量。 */
  readonly pageSize = 6
  /** 保存精选应用列表的检索词。 */
  readonly goodSearch = ref('')
  /** 跟踪个人应用列表请求并取消过期请求。 */
  private readonly myRequest = new LatestRequest()
  /** 跟踪精选应用列表请求并取消过期请求。 */
  private readonly goodRequest = new LatestRequest()
  /** 标记首页应用列表是否已完成首次初始化。 */
  private initialized = false
  /** 标记控制器是否已清理，阻止离页后继续更新状态。 */
  private disposed = false

  /** 接收首页应用列表控制器运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供页面级会话、路由和通知依赖。 */
    private readonly dependencies: PageDependencies,
    /** 提供控制器所需的后端接口操作。 */
    private readonly api: Pick<AppRepository, 'listMyVoByPage' | 'listGoodVoByPage'>,
  ) {}

  /** 加载当前用户的应用列表。 */
  loadMyApps = async (): Promise<void> => {
    if (this.disposed) return
    const request = this.myRequest.begin()
    if (!this.isLoggedIn.value) {
      this.myAppsState.value = []
      this.myTotalState.value = 0
      this.isMyLoadingState.value = false
      return
    }
    this.isMyLoadingState.value = true
    try {
      const response = await this.api.listMyVoByPage(
        {
          pageNum: this.myPageState.value,
          pageSize: this.pageSize,
          sortField: 'createTime',
          sortOrder: 'descend',
        },
        { signal: request.signal },
      )
      if (!request.isCurrent()) return
      this.myAppsState.value = response.data.data?.records || []
      this.myTotalState.value = response.data.data?.totalRow || 0
    } catch (error) {
      if (request.isCurrent()) this.notify.error(errorMessage(error, '网络异常，我的应用加载失败'))
    } finally {
      if (request.isCurrent()) this.isMyLoadingState.value = false
    }
  }

  /** 加载首页精选应用列表。 */
  loadGoodApps = async (): Promise<void> => {
    if (this.disposed) return
    const request = this.goodRequest.begin()
    this.isGoodLoadingState.value = true
    try {
      const response = await this.api.listGoodVoByPage(
        {
          pageNum: this.goodPageState.value,
          pageSize: this.pageSize,
          appName: this.goodSearch.value.trim() || undefined,
          sortField: 'createTime',
          sortOrder: 'descend',
        },
        { signal: request.signal },
      )
      if (!request.isCurrent()) return
      this.goodAppsState.value = response.data.data?.records || []
      this.goodTotalState.value = response.data.data?.totalRow || 0
    } catch (error) {
      if (request.isCurrent()) this.notify.error(errorMessage(error, '网络异常，精选应用加载失败'))
    } finally {
      if (request.isCurrent()) this.isGoodLoadingState.value = false
    }
  }

  /** 处理应用保存完成后的列表刷新。 */
  handleAppSaved = (updatedApp: AppSummary): void => {
    const updateApp = (app: AppSummary) =>
      app.id === updatedApp.id ? { ...app, ...updatedApp } : app
    this.myAppsState.value = this.myAppsState.value.map(updateApp)
    this.goodAppsState.value = this.goodAppsState.value.map(updateApp)
    void this.loadMyApps()
    void this.loadGoodApps()
  }

  /** 按关键词筛选精选应用。 */
  searchGoodApps = async (): Promise<void> => {
    this.goodPageState.value = 1
    await this.loadGoodApps()
  }

  /** 切换个人应用列表页码。 */
  changeMyPage = async (page: number): Promise<void> => {
    this.myPageState.value = page
    await this.loadMyApps()
  }

  /** 切换精选应用列表页码。 */
  changeGoodPage = async (page: number): Promise<void> => {
    this.goodPageState.value = page
    await this.loadGoodApps()
  }

  /** 启动控制器所需的初始加载或监听。 */
  start = async (): Promise<void> => {
    this.disposed = false
    await this.store.fetchLoginUser()
    await Promise.all([this.loadMyApps(), this.loadGoodApps()])
    this.initialized = true
  }
  /** 登录状态变化后刷新个人应用列表。 */
  sessionChanged = (): void => {
    if (!this.initialized) return
    this.myPageState.value = 1
    this.myAppsState.value = []
    void this.loadMyApps()
  }
  /** 用户移除后刷新列表数据。 */
  refreshAfterRemoval = async (): Promise<void> => {
    if (this.myAppsState.value.length === 1 && this.myPageState.value > 1)
      this.myPageState.value -= 1
    await Promise.all([this.loadMyApps(), this.loadGoodApps()])
  }
  /** 取消未完成任务并释放控制器持有的资源。 */
  dispose = (): void => {
    this.disposed = true
    this.myRequest.cancel()
    this.goodRequest.cancel()
  }
}
