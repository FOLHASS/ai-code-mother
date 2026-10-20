import { onMounted, onScopeDispose } from 'vue'
import { useRouter } from 'vue-router'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'
import { notifier, confirm } from './services.ts'
import type {ControllerCommonContext } from '@/shared/ports.ts'
import { errorMessage } from '@/shared/api/errors.ts'


/**
 * 为
 */
export function useControllerContext(): ControllerCommonContext {
  return { session: useLoginUserStore(), router: useRouter(), notify: notifier, confirm }
}


/**
 * 由 Vue 装配层统一注册页面级控制器的生命周期。
 * 采用适配器模式对于每一个controller的类型进行约束
 * 同时实现基本的生命周期管理
 * 1. controller的初始化和内部监听
 * 2. 必要的资源销毁
 * @param controller
 */
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

export type ControllerLifecycle = { start?: () => void | Promise<void>; dispose?: () => void }
