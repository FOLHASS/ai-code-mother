import { appPermissionPolicy } from '@/features/app-management'
import { errorMessage } from '@/shared/api/errors.ts'
import type { PageDependencies } from '@/shared/ports.ts'
import type { AppRepository } from '@/features/app-management'
import type { AppSummary } from '@/shared/domain/models.ts'
import { readonly, computed, ref } from 'vue'

import type { HomeAppsController } from './HomeAppsController.ts'

/** 管理首页应用创建、卡片导航、编辑和删除操作。 */
export class HomePageController {
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

  /** 保存是否创建中状态的内部响应状态。 */
  private readonly isCreatingState = ref(false)
  /** 只读暴露用户创建操作是否正在执行。 */
  readonly isCreating = readonly(this.isCreatingState)
  /** 保存编辑弹窗当前选中应用的内部状态。 */
  private readonly editingAppState = ref<AppSummary | null>(null)
  /** 只读暴露当前在弹窗中编辑的应用。 */
  readonly editingApp = readonly(this.editingAppState)
  /** 保存显示编辑弹窗的内部响应状态。 */
  private readonly showEditModalState = ref(false)
  /** 只读暴露编辑弹窗的显示状态。 */
  readonly showEditModal = readonly(this.showEditModalState)
  /** 只读暴露导航栏显示的用户名称。 */
  readonly displayName = computed(
    () => this.store.loginUser.userName || this.store.loginUser.userAccount || '创作者',
  )

  /** 接收首页控制器运行所需的依赖并初始化状态。 */
  constructor(
    /** 只读暴露当前应用列表。 */
    private readonly apps: HomeAppsController,
    /** 提供页面级会话、路由和通知依赖。 */
    private readonly dependencies: PageDependencies,
    /** 提供控制器所需的后端接口操作。 */
    private readonly api: Pick<AppRepository, 'add' | 'delete'>,
  ) {}

  /**
   * 提交用户输出等提示词、鉴权【用户是否登陆】，然后打开AppChat页面
   * @param prompt
   */
  submitPrompt = async (prompt: string): Promise<void> => {
    if (this.disposed) return
    if (this.isCreatingState.value) return
    const initPrompt = prompt.trim()
    if (!initPrompt) {
      this.notify.warning('先描述你想创建的网站')
      return
    }
    if (!this.apps.isLoggedIn.value) {
      await this.router.push({ path: '/user/login', query: { redirect: '/' } })
      return
    }
    this.isCreatingState.value = true
    try {
      const response = await this.api.add({ initPrompt })
      if (this.disposed) return
      await this.router.push(`/app/${response.data.data}`)
    } catch (error) {
      if (this.disposed) return
      this.notify.error(errorMessage(error, '网络异常，应用创建失败'))
    } finally {
      this.isCreatingState.value = false
    }
  }

  /** 导航到应用详情或聊天页面。 */
  openApp = (app: AppSummary): void => {
    if (app.id) void this.router.push(`/app/${app.id}`)
  }

  /** 打开应用编辑流程。 */
  editApp = (app: AppSummary): void => {
    if (!app.id) return
    if (
      !appPermissionPolicy.evaluate(
        { id: this.store.loginUser.id, role: this.store.loginUser.userRole },
        { ownerId: app.userId },
      ).isOwner
    ) {
      this.notify.warning('只能编辑自己的作品')
      return
    }
    this.editingAppState.value = app
    this.showEditModalState.value = true
  }

  /** 执行应用删除并处理删除后的页面状态。 */
  removeApp = (app: AppSummary): void => {
    if (!app.id) return
    this.dependencies.confirm({
      title: '删除这个应用？',
      content: `删除后将无法恢复“${app.appName || '未命名应用'}”。`,
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => this.deleteApp(app),
    })
  }

  /** 删除指定应用并同步更新列表。 */
  private deleteApp = async (app: AppSummary): Promise<void> => {
    if (this.disposed) return
    try {
      await this.api.delete({ id: app.id })
      if (this.disposed) return
      this.notify.success('应用已删除')
      await this.apps.refreshAfterRemoval()
    } catch (error) {
      if (this.disposed) return
      this.notify.error(errorMessage(error, '网络异常，应用删除失败'))
    }
  }
  /** 设置应用编辑弹窗的显示状态。 */
  setEditModalOpen = (open: boolean): void => {
    this.showEditModalState.value = open
  }

  /** 取消未完成任务并释放控制器持有的资源。 */
  dispose = (): void => {
    this.disposed = true
  }
}
