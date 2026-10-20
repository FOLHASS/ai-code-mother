import { computed, reactive, readonly, ref } from 'vue'
import { appPermissionPolicy } from './AppPermissionPolicyService.ts'
import { LatestRequest } from '@/shared/async/LatestRequest.ts'
import { errorMessage } from '@/shared/api/errors.ts'
import type { ControllerCommonContext } from '@/shared/ports.ts'
import type { AppApi } from '../api/AppApiClient.ts'
import type { AppInfo, AppUpdate } from '@/shared/domain/models.ts'

export type AppEditModalProps = {
  open: boolean
  app: AppInfo | null
}

export type AppEditModalEvents = {
  updateOpen: (open: boolean) => void
  saved: (app: AppInfo) => void
}

/** 统一管理应用编辑弹窗的数据加载、权限检查和保存流程。 */
export class AppEditModalController {
  /** 使关闭、切换应用或卸载前发出的请求失效。 */
  private readonly requests = new LatestRequest()
  /** 标记控制器是否已随页面销毁。 */
  private disposed = false
  /** 保存本次打开时读取到的应用信息，避免直接修改列表数据。 */
  private readonly appState = ref<AppInfo | null>(null)
  /** 保存弹窗详情加载状态。 */
  private readonly loading = ref(false)
  /** 保存详情加载错误，供弹窗展示和重试。 */
  private readonly error = ref('')
  /** 保存提交状态，防止重复保存和提交中关闭。 */
  private readonly saving = ref(false)
  /** 对外只读暴露本次编辑的应用快照。 */
  readonly app = readonly(this.appState)
  /** 对外只读暴露详情加载状态。 */
  readonly isLoading = readonly(this.loading)
  /** 对外只读暴露详情加载错误。 */
  readonly loadError = readonly(this.error)
  /** 对外只读暴露保存状态。 */
  readonly isSaving = readonly(this.saving)
  /** 保存可编辑草稿；普通用户提交时仅使用应用名称。 */
  readonly form = reactive({ appName: '', cover: '', priority: 0 })
  /** 根据统一权限策略判断当前会话是否具有管理员权限。 */
  readonly isAdmin = computed(() => this.permissions().isAdmin)
  /** 根据编辑权限生成弹窗标题。 */
  readonly title = computed(() => (this.isAdmin.value ? '编辑应用信息' : '编辑我的应用'))

  /** 注入弹窗输入、事件、会话及窄接口依赖，不读取路由上下文。 */
  constructor(
    /** 提供弹窗显隐状态和选中应用。 */
    private readonly props: AppEditModalProps,
    /** 将关闭和保存结果交回所属页面。 */
    private readonly events: AppEditModalEvents,
    /** 提供会话初始化和界面通知能力。 */
    private readonly dependencies: Pick<ControllerCommonContext, 'session' | 'notify'>,
    /** 读取最新应用详情并根据角色选择更新接口。 */
    private readonly api: Pick<
      AppApi,
      'getVoById' | 'adminGetVoById' | 'update' | 'adminUpdate'
    >,
  ) {}

  /** 计算当前用户对指定应用的权限，避免复制管理员和归属判断。 */
  private permissions(app = this.appState.value) {
    const user = this.dependencies.session.loginUser
    return appPermissionPolicy.evaluate(
      { id: user.id, role: user.userRole },
      { ownerId: app?.userId },
    )
  }

  /** 打开或切换目标时读取详情；关闭时清空草稿并取消旧请求。 */
  load = async (): Promise<void> => {
    if (this.disposed) return
    const request = this.requests.begin()
    this.appState.value = null
    this.error.value = ''
    this.loading.value = false
    this.saving.value = false
    Object.assign(this.form, { appName: '', cover: '', priority: 0 })
    const id = this.props.app?.id
    if (!this.props.open || !id) return

    this.loading.value = true
    try {
      await this.dependencies.session.fetchLoginUser()
      if (!request.isCurrent()) return
      const response = await (this.isAdmin.value ? this.api.adminGetVoById : this.api.getVoById)(
        { id },
        { signal: request.signal },
      )
      if (!request.isCurrent()) return
      const app = response.data.data
      if (!this.permissions(app).canEdit) throw new Error('无权编辑这个应用')
      this.appState.value = app
      Object.assign(this.form, {
        appName: app.appName || '',
        cover: app.cover || '',
        priority: app.priority || 0,
      })
    } catch (error) {
      if (request.isCurrent()) this.error.value = errorMessage(error, '应用信息加载失败')
    } finally {
      if (request.isCurrent()) this.loading.value = false
    }
  }

  /** 提交中保留弹窗，其余时候取消加载并通知页面关闭。 */
  close = (): void => {
    if (this.disposed || this.saving.value) return
    this.requests.cancel()
    this.events.updateOpen(false)
  }

  /** 保存草稿并通知原页面刷新，保留原页面的分页和检索上下文。 */
  save = async (): Promise<void> => {
    const app = this.appState.value
    if (
      this.disposed ||
      !this.props.open ||
      this.loading.value ||
      this.saving.value ||
      !app ||
      app.id !== this.props.app?.id
    )
      return
    const permissions = this.permissions(app)
    if (!permissions.canEdit) {
      this.dependencies.notify.warning('无权编辑这个应用')
      return
    }
    const appName = this.form.appName.trim()
    if (!appName || appName.length > 50) {
      this.dependencies.notify.warning('请输入不超过 50 个字符的应用名称')
      return
    }
    if (
      permissions.isAdmin &&
      (!Number.isSafeInteger(this.form.priority) || this.form.priority < 0)
    ) {
      this.dependencies.notify.warning('优先级必须为非负整数')
      return
    }
    const payload: AppUpdate = {
      id: app.id,
      appName,
      ...(permissions.isAdmin
        ? { cover: this.form.cover.trim(), priority: this.form.priority }
        : {}),
    }
    const request = this.requests.begin()
    this.saving.value = true
    try {
      await (permissions.isAdmin ? this.api.adminUpdate : this.api.update)(payload, {
        signal: request.signal,
      })
      if (!request.isCurrent()) return
      this.dependencies.notify.success('应用信息已保存')
      this.events.saved({ ...app, ...payload })
      this.events.updateOpen(false)
    } catch (error) {
      if (request.isCurrent())
        this.dependencies.notify.error(errorMessage(error, '应用信息保存失败'))
    } finally {
      if (request.isCurrent()) this.saving.value = false
    }
  }

  /** 页面卸载后中止请求，并阻止晚到结果修改弹窗或原列表。 */
  dispose = (): void => {
    this.disposed = true
    this.requests.cancel()
  }
}
