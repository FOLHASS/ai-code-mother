import { computed } from 'vue'
import type { MenuProps } from 'ant-design-vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { PageDependencies } from '@/shared/ports.ts'
import type { UserRepository } from '../api/UserApiClient.ts'
import { errorMessage } from '@/shared/api/errors.ts'

/** 管理全局导航菜单及当前用户操作。 */
export class GlobalHeaderController {
  /** 保存当前导航菜单选中的键。 */
  readonly selectedKeys = computed(() => [this.route.path])
  /** 只读暴露当前用户是否已登录。 */
  readonly isLoggedIn = computed(() => Boolean(this.dependencies.session.loginUser.id))
  /** 只读暴露导航栏显示的用户名称。 */
  readonly displayName = computed(
    () =>
      this.dependencies.session.loginUser.userName ||
      this.dependencies.session.loginUser.userAccount ||
      '用户',
  )
  /** 保存用户头像地址。 */
  readonly avatarUrl = computed(() => this.dependencies.session.loginUser.userAvatar)
  /** 保存用户菜单中展示的操作项。 */
  readonly userMenuItems: MenuProps['items'] = [
    { key: 'profile', label: '个人信息' },
    { type: 'divider' },
    { key: 'logout', label: '退出登录' },
  ]
  /** 记录退出登录操作是否正在执行。 */
  private loggingOut = false

  /** 接收全局导航控制器运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供页面级会话、路由和通知依赖。 */
    private readonly dependencies: PageDependencies,
    /** 提供控制器所需的后端接口操作。 */
    private readonly api: Pick<UserRepository, 'logout'>,
    /** 提供当前页面的路由参数和查询条件。 */
    private readonly route: Pick<RouteLocationNormalizedLoaded, 'path' | 'fullPath'>,
    /** 根据当前路由计算导航菜单选中项的函数。 */
    private readonly selectMenu: (key: string) => void,
  ) {}

  /** 导航到登录页面并保留当前回跳地址。 */
  goToLogin = (): void => {
    void this.dependencies.router.push({
      path: '/user/login',
      query: { redirect: this.route.fullPath },
    })
  }
  /** 处理全局导航菜单项的选择。 */
  handleMenuClick = ({ key }: { key: string | number }): void => {
    if (typeof key === 'string') this.selectMenu(key)
  }
  /** 处理用户菜单项的选择及对应操作。 */
  handleUserMenuClick = async ({ key }: { key: string | number }): Promise<void> => {
    if (key === 'profile') {
      await this.dependencies.router.push('/user/profile')
      return
    }
    if (key !== 'logout' || this.loggingOut) return
    this.loggingOut = true
    try {
      await this.api.logout()
      this.dependencies.session.clearSession()
      await this.dependencies.router.push('/user/login')
    } catch (error) {
      this.dependencies.notify.error(errorMessage(error, '退出登录失败，请重试'))
    } finally {
      this.loggingOut = false
    }
  }
}
