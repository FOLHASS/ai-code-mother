import { appPermissionPolicy } from './AppPermissionPolicyService.ts'
import { errorMessage } from '@/shared/api/errors.ts'
import type { PageDependencies } from '@/shared/ports.ts'
import type { AppRepository } from '../api/AppApiClient.ts'
import type { AppSummary } from '@/shared/domain/models.ts'
import { readonly, ref } from 'vue'

export type AppEditModalProps = {
  open: boolean
  app: AppSummary | null
}

export type AppEditModalEvents = {
  updateOpen: (open: boolean) => void
  saved: (app: AppSummary) => void
}

/** 管理首页应用编辑弹窗中的表单草稿和保存流程。 */
export class AppEditModalController {
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

  /** 保存表单中的应用名称。 */
  readonly appName = ref('')
  /** 保存是否保存中状态的内部响应状态。 */
  private readonly isSavingState = ref(false)
  /** 只读暴露资料保存操作是否正在执行。 */
  readonly isSaving = readonly(this.isSavingState)

  /** 接收应用编辑弹窗控制器运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供弹窗当前的显示状态和应用数据。 */
    private readonly props: AppEditModalProps,
    /** 提供关闭弹窗和通知保存结果的回调。 */
    private readonly events: AppEditModalEvents,
    /** 提供页面级会话、路由和通知依赖。 */
    private readonly dependencies: PageDependencies,
    /** 提供控制器所需的后端接口操作。 */
    private readonly api: Pick<AppRepository, 'update'>,
  ) {}

  /** 恢复编辑表单初始值并清除错误状态。 */
  reset = (): void => {
    if (this.props.open) this.appName.value = this.props.app?.appName || ''
  }

  /** 关闭相关状态或数据。 */
  close = (): void => {
    if (!this.isSavingState.value) this.events.updateOpen(false)
  }

  /** 校验并保存当前编辑内容。 */
  save = async (): Promise<void> => {
    if (this.disposed) return
    const app = this.props.app
    if (this.isSavingState.value || !app?.id) return
    if (
      !appPermissionPolicy.evaluate(
        { id: this.store.loginUser.id, role: this.store.loginUser.userRole },
        { ownerId: app.userId },
      ).isOwner
    ) {
      this.notify.warning('只能编辑自己的作品')
      return
    }
    const name = this.appName.value.trim()
    if (!name) {
      this.notify.warning('请输入应用名称')
      return
    }
    this.isSavingState.value = true
    try {
      await this.api.update({ id: app.id, appName: name })
      if (this.disposed || this.props.app?.id !== app.id) return
      this.events.saved({ ...app, appName: name })
      this.events.updateOpen(false)
      this.notify.success('应用名称已更新')
    } catch (error) {
      if (this.disposed) return
      this.notify.error(errorMessage(error, '网络异常，应用信息保存失败'))
    } finally {
      this.isSavingState.value = false
    }
  }
  /** 取消未完成任务并释放控制器持有的资源。 */
  dispose = (): void => {
    this.disposed = true
  }
}
