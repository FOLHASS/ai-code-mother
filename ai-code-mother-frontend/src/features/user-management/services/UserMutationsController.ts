import { errorMessage } from '@/shared/api/errors.ts'
import type { ControllerCommonContext } from '@/shared/ports.ts'
import type { UserApi } from '../api/UserApiClient.ts'
import type { UserCreate, UserInfo, UserUpdate } from '@/shared/domain/models.ts'
import { readonly, ref } from 'vue'

type UserMutationContext = {
  loadUsers: () => Promise<void>
  refreshAfterCreation: () => Promise<void>
  refreshAfterRemoval: () => Promise<void>
}

/** 管理用户创建、编辑和删除弹窗及提交状态。 */
export class UserMutationsController {
  /** 标记控制器是否已清理，阻止离页后继续更新状态。 */
  private disposed = false
  /** 提供当前应用的路由对象。 */
  get router() {
    return this.dependencies.router
  }
  /** 提供界面通知能力。 */
  private get notify() {
    return this.dependencies.notify
  }

  /** 保存是否保存中状态的内部响应状态。 */
  private readonly isSavingState = ref(false)
  /** 只读暴露资料保存操作是否正在执行。 */
  readonly isSaving = readonly(this.isSavingState)
  /** 保存是否删除中状态的内部响应状态。 */
  private readonly isDeletingState = ref(false)
  /** 只读暴露用户删除操作是否正在执行。 */
  readonly isDeleting = readonly(this.isDeletingState)
  /** 保存是否创建中状态的内部响应状态。 */
  private readonly isCreatingState = ref(false)
  /** 只读暴露用户创建操作是否正在执行。 */
  readonly isCreating = readonly(this.isCreatingState)
  /** 保存新建用户弹窗的内部显示状态。 */
  private readonly showCreateModalState = ref(false)
  /** 只读暴露新建用户弹窗的显示状态。 */
  readonly showCreateModal = readonly(this.showCreateModalState)
  /** 保存显示编辑弹窗的内部响应状态。 */
  private readonly showEditModalState = ref(false)
  /** 只读暴露编辑弹窗的显示状态。 */
  readonly showEditModal = readonly(this.showEditModalState)
  /** 保存选中用户的内部响应状态。 */
  private readonly selectedUserState = ref<UserInfo | null>(null)
  /** 只读暴露当前选中的用户。 */
  readonly selectedUser = readonly(this.selectedUserState)

  /** 接收用户变更控制器运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供当前业务流程使用的共享状态和回调。 */
    private readonly context: UserMutationContext,
    /** 提供页面级会话、路由和通知依赖。 */
    private readonly dependencies: ControllerCommonContext,
    /** 提供控制器所需的后端接口操作。 */
    private readonly api: Pick<UserApi, 'add' | 'update' | 'delete'>,
  ) {}

  /** 打开编辑弹窗并填入所选用户信息。 */
  openEditModal = (user: UserInfo): void => {
    this.selectedUserState.value = user
    this.showEditModalState.value = true
  }

  /** 打开新建用户弹窗并初始化表单。 */
  openCreateModal = (): void => {
    this.showCreateModalState.value = true
  }

  /** 关闭新建用户弹窗并清理表单状态。 */
  closeCreateModal = (): void => {
    if (!this.isCreatingState.value) this.showCreateModalState.value = false
  }

  /** 校验并提交新用户信息。 */
  handleCreateUser = async (form: UserCreate): Promise<void> => {
    if (this.disposed) return
    if (this.isCreatingState.value) return
    const userAccount = form.userAccount?.trim() || ''
    if (!userAccount) {
      this.notify.warning('请填写用户账号')
      return
    }
    this.isCreatingState.value = true
    try {
      await this.api.add({
        ...form,
        userAccount,
        userName: form.userName?.trim() || undefined,
        userAvatar: form.userAvatar?.trim() || undefined,
        userProfile: form.userProfile?.trim() || undefined,
      })
      if (this.disposed) return
      this.notify.success('用户创建成功')
      this.showCreateModalState.value = false
      await this.context.refreshAfterCreation()
    } catch (error) {
      if (this.disposed) return
      this.notify.error(errorMessage(error, '网络异常，用户创建失败'))
    } finally {
      this.isCreatingState.value = false
    }
  }

  /** 关闭编辑用户弹窗并清理表单状态。 */
  closeEditModal = (): void => {
    if (!this.isSavingState.value) this.showEditModalState.value = false
  }

  /** 校验并提交用户资料变更。 */
  handleSaveUser = async (form: UserUpdate): Promise<void> => {
    if (this.disposed) return
    if (this.isSavingState.value) return
    const userName = form.userName?.trim() || ''
    if (!form.id || !userName) {
      this.notify.warning('请填写用户昵称')
      return
    }
    this.isSavingState.value = true
    try {
      await this.api.update({
        ...form,
        userName,
        userProfile: form.userProfile?.trim(),
      })
      if (this.disposed) return
      this.notify.success('用户信息已更新')
      this.showEditModalState.value = false
      await this.context.loadUsers()
    } catch (error) {
      if (this.disposed) return
      this.notify.error(errorMessage(error, '网络异常，用户信息更新失败'))
    } finally {
      this.isSavingState.value = false
    }
  }

  /** 请求删除所选用户并更新列表。 */
  handleDeleteUser = (user: UserInfo): void => {
    if (!user.id) return
    this.dependencies.confirm({
      title: '确认删除用户？',
      content: `删除后将无法恢复用户“${user.userName || user.userAccount || user.id}”。`,
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => this.deleteUser(user),
    })
  }

  /** 删除指定用户并处理操作结果。 */
  private deleteUser = async (user: UserInfo): Promise<void> => {
    if (this.disposed) return
    if (this.isDeletingState.value || !user.id) return
    this.isDeletingState.value = true
    try {
      await this.api.delete({ id: user.id })
      if (this.disposed) return
      this.notify.success('用户已删除')
      await this.context.refreshAfterRemoval()
    } catch (error) {
      if (this.disposed) return
      this.notify.error(errorMessage(error, '网络异常，用户删除失败'))
    } finally {
      this.isDeletingState.value = false
    }
  }
  /** 取消未完成任务并释放控制器持有的资源。 */
  dispose = (): void => {
    this.disposed = true
  }
}
