import type { Router } from 'vue-router'
import type { SessionPort } from '@/shared/ports.ts'
import { authEvents } from '@/shared/api/authEvents.ts'

/** 注册会话过期处理逻辑。 */
export function installSessionExpiry(router: Router, session: SessionPort): () => void {
  let redirecting = false
  return authEvents.subscribe(() => {
    session.clearSession()
    const route = router.currentRoute.value
    if (redirecting || (!route.meta.requiresAuth && !route.meta.requiresAdmin)) return
    redirecting = true
    void router
      .replace({ path: '/user/login', query: { redirect: route.fullPath } })
      .catch(() => undefined)
      .finally(() => {
        redirecting = false
      })
  })
}
