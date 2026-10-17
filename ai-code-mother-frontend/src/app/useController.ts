import { onMounted, onScopeDispose } from 'vue'
import { useRouter } from 'vue-router'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'
import { notifier, confirm } from './services.ts'
import type { ControllerLifecycle, PageDependencies } from '@/shared/ports.ts'
import { errorMessage } from '@/shared/api/errors.ts'

/** 为页面组合并提供所需的控制器依赖。 */
export function usePageDependencies(): PageDependencies {
  return { session: useLoginUserStore(), router: useRouter(), notify: notifier, confirm }
}

/** 由 Vue 装配层统一注册页面级控制器的生命周期。 */
export function useController<T extends ControllerLifecycle>(controller: T): T {
  let disposed = false
  onMounted(() => {
    void Promise.resolve()
      .then(() => {
        if (!disposed) return controller.start?.()
      })
      .catch((error) => notifier.error(errorMessage(error)))
  })
  onScopeDispose(() => {
    disposed = true
    controller.dispose?.()
  })
  return controller
}
