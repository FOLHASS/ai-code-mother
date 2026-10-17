import { computed, reactive, readonly, ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { AppSummary, AppUpdate } from '@/shared/domain/models.ts'
import type { PageDependencies } from '@/shared/ports.ts'
import type { AppRepository } from '../api/AppApiClient.ts'
import { LatestRequest } from '@/shared/async/LatestRequest.ts'
import { errorMessage } from '@/shared/api/errors.ts'
import { USER_ROLE } from '@/shared/domain/constants.ts'
import { appPermissionPolicy } from './AppPermissionPolicyService.ts'

/** 加载并保存应用编辑页面的数据。 */
export class AppEditController {
  /** 保存应用的内部响应状态。 */
  private readonly appState = ref<AppSummary | null>(null)
  /** 记录历史记录是否正在加载。 */
  private readonly loading = ref(true)
  /** 记录资料保存操作是否正在执行。 */
  private readonly saving = ref(false)
  /** 提供带过期保护的异步请求控制。 */
  private readonly request = new LatestRequest()
  /** 标记控制器是否已清理，阻止离页后继续更新状态。 */
  private disposed = false
  /** 保存当前正在编辑或操作的应用数据。 */
  readonly app = readonly(this.appState)
  /** 只读暴露列表数据是否正在加载。 */
  readonly isLoading = readonly(this.loading)
  /** 只读暴露资料保存操作是否正在执行。 */
  readonly isSaving = readonly(this.saving)
  /** 保存当前表单输入数据。 */
  readonly form = reactive<AppUpdate>({ appName: '', cover: '', priority: 0 })
  /** 保存当前路由中的应用 ID。 */
  readonly appId = computed(() => String(this.route.params.id || ''))
  /** 记录当前用户是否拥有管理员权限。 */
  readonly isAdmin = computed(
    () => this.dependencies.session.loginUser.userRole === USER_ROLE.ADMIN,
  )
  /** 保存当前页面标题。 */
  readonly pageTitle = computed(() => (this.isAdmin.value ? '编辑应用信息' : '编辑我的应用'))
  /** 提供当前应用的路由对象。 */
  get router() {
    return this.dependencies.router
  }

  /** 接收应用编辑控制器运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供当前页面的路由参数和查询条件。 */
    private readonly route: Pick<RouteLocationNormalizedLoaded, 'params'>,
    /** 提供页面级会话、路由和通知依赖。 */
    private readonly dependencies: PageDependencies,
    /** 提供控制器所需的后端接口操作。 */
    private readonly api: Pick<
      AppRepository,
      'getVoById' | 'adminGetVoById' | 'update' | 'adminUpdate'
    >,
  ) {}

  /** 启动控制器所需的初始加载或监听。 */
  start = async (): Promise<void> => {
    this.disposed = false
    await this.dependencies.session.fetchLoginUser()
    if (!this.disposed) await this.load()
  }
  /** 取消未完成任务并释放控制器持有的资源。 */
  dispose = (): void => {
    this.disposed = true
    this.request.cancel()
  }

  /** 加载所需数据并更新对应的服务状态。 */
  load = async (): Promise<void> => {
    if (this.disposed) return
    const request = this.request.begin()
    const id = this.appId.value
    this.appState.value = null
    Object.assign(this.form, { id: undefined, appName: '', cover: '', priority: 0 })
    if (!id) {
      await this.router.replace('/')
      return
    }
    this.loading.value = true
    try {
      const response = await (this.isAdmin.value ? this.api.adminGetVoById : this.api.getVoById)(
        { id },
        { signal: request.signal },
      )
      if (!request.isCurrent()) return
      const app = response.data.data
      const user = this.dependencies.session.loginUser
      if (
        !appPermissionPolicy.evaluate({ id: user.id, role: user.userRole }, { ownerId: app.userId })
          .canEdit
      ) {
        this.dependencies.notify.warning('无权编辑这个应用')
        await this.router.replace(`/app/${id}`)
        return
      }
      this.appState.value = app
      Object.assign(this.form, {
        id: app.id,
        appName: app.appName || '',
        cover: app.cover || '',
        priority: app.priority || 0,
      })
    } catch (error) {
      if (!request.isCurrent()) return
      this.dependencies.notify.error(errorMessage(error, '应用信息加载失败'))
      await this.router.replace('/')
    } finally {
      if (request.isCurrent()) this.loading.value = false
    }
  }

  /** 校验并保存当前编辑内容。 */
  save = async (): Promise<void> => {
    if (this.saving.value || this.disposed) return
    const id = this.form.id
    const appName = this.form.appName?.trim() || ''
    if (!id || !appName) {
      this.dependencies.notify.warning('请输入应用名称')
      return
    }
    this.saving.value = true
    const admin = this.isAdmin.value
    try {
      await (admin ? this.api.adminUpdate : this.api.update)({
        id,
        appName,
        ...(admin
          ? {
              cover: this.form.cover?.trim() || undefined,
              priority: Number(this.form.priority) || 0,
            }
          : {}),
      })
      if (this.disposed || id !== this.appId.value) return
      this.dependencies.notify.success('应用信息已保存')
      await this.router.push(admin ? '/admin/appManage' : `/app/${id}`)
    } catch (error) {
      if (!this.disposed && id === this.appId.value)
        this.dependencies.notify.error(errorMessage(error))
    } finally {
      this.saving.value = false
    }
  }
}
