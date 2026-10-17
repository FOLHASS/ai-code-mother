import { reactive, readonly, ref } from 'vue'
import type { UserUpdate } from '@/shared/domain/models.ts'
import type { PageDependencies } from '@/shared/ports.ts'
import type { UserRepository } from '../api/UserApiClient.ts'
import { errorMessage } from '@/shared/api/errors.ts'

/** 管理个人资料编辑表单的重置、保存和清理。 */
export class ProfileEditorController {
  /** 标记控制器是否已清理，阻止离页后继续更新状态。 */
  private disposed = false
  /** 保存当前表单输入数据。 */
  readonly form = reactive<UserUpdate>({ userName: '', userAvatar: '', userProfile: '' })
  /** 记录资料保存操作是否正在执行。 */
  private readonly saving = ref(false)
  /** 只读暴露资料保存操作是否正在执行。 */
  readonly isSaving = readonly(this.saving)

  /** 接收个人资料编辑控制器运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供页面级会话、路由和通知依赖。 */
    private readonly dependencies: PageDependencies,
    /** 提供控制器所需的后端接口操作。 */
    private readonly api: Pick<UserRepository, 'update'>,
  ) {
    this.reset()
  }

  /** 清空当前流程状态并恢复初始值。 */
  reset = (): void => {
    const user = this.dependencies.session.loginUser
    Object.assign(this.form, {
      userName: user.userName || '',
      userAvatar: user.userAvatar || '',
      userProfile: user.userProfile || '',
    })
  }

  /** 校验并保存当前编辑内容。 */
  save = async (): Promise<void> => {
    if (this.disposed) return
    if (this.saving.value) return
    const user = this.dependencies.session.loginUser
    if (!user.id) {
      this.dependencies.notify.warning('当前登录状态已失效，请重新登录')
      return
    }
    const userName = this.form.userName?.trim() || ''
    if (!userName) {
      this.dependencies.notify.warning('请输入用户昵称')
      return
    }
    const changes = {
      userName,
      userAvatar: this.form.userAvatar?.trim() || undefined,
      userProfile: this.form.userProfile?.trim() || undefined,
    }
    this.saving.value = true
    try {
      await this.api.update({ id: user.id, ...changes })
      if (this.disposed) return
      if (this.dependencies.session.loginUser.id !== user.id) return
      this.dependencies.session.setLoginUser({ ...this.dependencies.session.loginUser, ...changes })
      this.dependencies.notify.success('个人信息已保存')
    } catch (error) {
      this.dependencies.notify.error(errorMessage(error, '个人信息保存失败'))
    } finally {
      this.saving.value = false
    }
  }
  /** 取消未完成任务并释放控制器持有的资源。 */
  dispose = (): void => {
    this.disposed = true
  }
}
