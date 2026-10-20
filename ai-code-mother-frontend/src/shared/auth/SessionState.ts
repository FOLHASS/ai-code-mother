import { computed, readonly, ref } from 'vue'
import type { SessionUserInfo } from '@/shared/domain/models.ts'
import { errorMessage } from '@/shared/api/errors.ts'

export type SessionStatus = 'unknown' | 'loading' | 'authenticated' | 'anonymous' | 'error'

/**
 * 该类的设计巧妙之处在于：
 * 1. 使用pending去避免多次重复请求
 * 2. 使用version去避免旧的接口返回结果覆盖新的 （后触发的接口不一定比先的慢到达）
 * 3. 严格定义了当前Session的状态
 *  - 起始状态 unknown
 *  - 加载状态 loading
 *  - 授权状态 authenticated
 *  - 匿名状态 anonymous
 *  - 错误庄唉 error
 */

/** 集中保存登录用户、初始化状态和会话错误。 */
export class SessionState {
  /** 用递增版本号识别并忽略过期请求结果。 */
  private version = 0
  /** 复用正在执行的会话初始化请求。 */
  private pending: Promise<void> | null = null

  // 保存用户登录信息 其他情况用户名展示未登录即可
  private readonly userState = ref<SessionUserInfo>({ userName: '未登录' })
  // 维护当前session的状态
  private readonly statusState = ref<SessionStatus>('unknown')
  // 存储当前出现错误的信息
  private readonly errorState = ref('')

  /** 只读暴露当前登录用户。 */
  readonly loginUser = readonly(this.userState)
  /** 只读暴露当前会话初始化状态。 */
  readonly status = readonly(this.statusState)
  /** 保存最近一次加载失败的错误信息。 */
  readonly error = readonly(this.errorState)
  /** 只读暴露会话状态是否已初始化。 */
  readonly isInitialized = computed(() =>
    ['authenticated', 'anonymous'].includes(this.statusState.value),
  )

  /** 接收登录会话状态管理器运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供当前流程所需的loadUser依赖。 */
    private readonly loadUser: () => Promise<SessionUserInfo | null>,
  ) {}

  /** 查询当前登录用户并更新会话初始化结果。 */
  fetchLoginUser = (force = false): Promise<void> => {
    if (!force && this.isInitialized.value) return Promise.resolve()
    if (this.pending) return this.pending
    const version = this.version
    this.statusState.value = 'loading'
    this.errorState.value = ''
    const pending = Promise.resolve()
      .then(this.loadUser)
      .then((user) => {
        if (version !== this.version) return
        this.userState.value = user || { userName: '未登录' }
        this.statusState.value = user?.id ? 'authenticated' : 'anonymous'
      })
      .catch((error) => {
        if (version !== this.version) return
        this.statusState.value = 'error'
        this.errorState.value = errorMessage(error, '登录状态暂时无法确认，请稍后重试')
      })
      .finally(() => {
        if (this.pending === pending) this.pending = null
      })
    this.pending = pending
    return pending
  }

  /** 写入当前登录用户并标记会话已初始化。 */
  setLoginUser = (user: SessionUserInfo): void => {
    this.version += 1
    this.pending = null
    this.userState.value = { ...user }
    this.statusState.value = user.id ? 'authenticated' : 'anonymous'
    this.errorState.value = ''
  }

  /** 清除登录用户和会话错误状态。 */
  clearSession = (): void => this.setLoginUser({ userName: '未登录' })
}
