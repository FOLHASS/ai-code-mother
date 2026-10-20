import type { RouteLocationRaw } from 'vue-router'
import type { UserSession } from '@/shared/ports.ts'
import type { SessionStatus } from '@/shared/auth/SessionState.ts'
import { USER_ROLE } from '@/shared/domain/constants.ts'

/** 创建并配置应用路由导航守卫。 */
export function createNavigationGuard(
  getSession: () => Pick<UserSession, 'loginUser' | 'fetchLoginUser'> & {
    /** 保存当前业务状态。 */
    readonly status?: SessionStatus
  },
) {
  return async (to: {
    /** 保存包含查询参数的完整路由地址。 */
    fullPath: string
    /** 保存路由附加的页面元数据。 */
    meta: Record<string, unknown>
  }): Promise<true | RouteLocationRaw> => {
    const session = getSession()
    await session.fetchLoginUser()
    const protectedRoute = to.meta.requiresAuth || to.meta.requiresAdmin
    if (protectedRoute && (!session.loginUser.id || session.status === 'error'))
      return {
        name: 'loginPage',
        query: {
          redirect: to.fullPath,
          ...(session.status === 'error' ? { session: 'unavailable' } : {}),
        },
      }
    if (to.meta.requiresAdmin && session.loginUser.userRole !== USER_ROLE.ADMIN)
      return { path: '/', query: { forbidden: 'admin' } }
    return true
  }
}
