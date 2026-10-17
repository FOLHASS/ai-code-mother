import { errorMessage } from '@/shared/api/errors.ts'
import { USER_ROLE } from '@/shared/domain/constants.ts'
import { LatestRequest } from '@/shared/async/LatestRequest.ts'
import type { PageDependencies } from '@/shared/ports.ts'
import type { UserRepository } from '../api/UserApiClient.ts'
import type { UserQuery, UserSummary } from '@/shared/domain/models.ts'
import { readonly, computed, reactive, ref } from 'vue'

/** 管理用户列表查询、分页和变更后的刷新。 */
export class UserListController {
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

  /** 记录当前用户是否拥有管理员权限。 */
  readonly isAdmin = computed(() => this.store.loginUser.userRole === USER_ROLE.ADMIN)
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
  /** 保存总数用户的内部响应状态。 */
  private readonly totalUsersState = ref(0)
  /** 只读暴露当前用户列表的总记录数。 */
  readonly totalUsers = readonly(this.totalUsersState)
  /** 保存用户的内部响应状态。 */
  private readonly usersState = ref<UserSummary[]>([])
  /** 只读暴露当前用户列表。 */
  readonly users = readonly(this.usersState)
  /** 保存最近一次成功应用的用户检索条件。 */
  private readonly appliedQuery = reactive<UserQuery>({
    id: undefined,
    userName: '',
    userAccount: '',
    userProfile: '',
    userRole: undefined,
  })

  /** 接收用户列表控制器运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供页面级会话、路由和通知依赖。 */
    private readonly dependencies: PageDependencies,
    /** 提供控制器所需的后端接口操作。 */
    private readonly api: Pick<UserRepository, 'listVo'>,
  ) {}

  /** 按当前筛选和分页条件加载用户列表。 */
  loadUsers = async (): Promise<void> => {
    if (this.disposed) return
    const request = this.requests.begin()
    if (!this.isAdmin.value) {
      await this.router.replace('/')
      return
    }
    this.isLoadingState.value = true
    try {
      const response = await this.api.listVo(
        {
          ...this.appliedQuery,
          id: this.appliedQuery.id || undefined,
          userName: this.appliedQuery.userName?.trim() || undefined,
          userAccount: this.appliedQuery.userAccount?.trim() || undefined,
          userProfile: this.appliedQuery.userProfile?.trim() || undefined,
          pageNum: this.currentPageState.value,
          pageSize: this.pageSize,
        },
        { signal: request.signal },
      )
      if (!request.isCurrent()) return
      if (!request.isCurrent()) return
      this.usersState.value = response.data.data?.records || []
      this.totalUsersState.value = response.data.data?.totalRow || 0
    } catch (error) {
      if (request.isCurrent()) this.notify.error(errorMessage(error, '网络异常，用户列表加载失败'))
    } finally {
      if (request.isCurrent()) this.isLoadingState.value = false
    }
  }

  /** 提交用户检索条件并加载第一页。 */
  handleSearch = async (query: UserQuery): Promise<void> => {
    Object.assign(this.appliedQuery, query)
    this.currentPageState.value = 1
    await this.loadUsers()
  }

  /** 清空用户检索条件并重新加载列表。 */
  handleReset = async (): Promise<void> => {
    this.appliedQuery.id = undefined
    this.appliedQuery.userName = ''
    this.appliedQuery.userAccount = ''
    this.appliedQuery.userProfile = ''
    this.appliedQuery.userRole = undefined
    this.currentPageState.value = 1
    await this.loadUsers()
  }

  /** 切换用户列表页码并加载数据。 */
  handlePageChange = async (page: number): Promise<void> => {
    this.currentPageState.value = page
    await this.loadUsers()
  }

  /** 启动控制器所需的初始加载或监听。 */
  start = async (): Promise<void> => {
    this.disposed = false
    await this.store.fetchLoginUser()
    await this.loadUsers()
  }

  /** 取消未完成任务并释放控制器持有的资源。 */
  dispose = (): void => {
    this.disposed = true
    this.requests.cancel()
  }

  /** 用户移除后刷新列表数据。 */
  refreshAfterRemoval = async (): Promise<void> => {
    if (this.usersState.value.length === 1 && this.currentPageState.value > 1)
      this.currentPageState.value -= 1
    await this.loadUsers()
  }
  /** 用户创建成功后刷新列表数据。 */
  refreshAfterCreation = async (): Promise<void> => {
    this.currentPageState.value = 1
    await this.loadUsers()
  }
}
