import { computed, reactive, readonly, ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { UserLogin } from '@/shared/domain/models.ts'
import type { ControllerCommonContext } from '@/shared/ports.ts'
import type { UserApi } from '../api/UserApiClient.ts'
import { safeRedirect } from '@/shared/routing/redirect.ts'
import { errorMessage } from '@/shared/api/errors.ts'

/** 管理登录表单校验、提交和登录后回跳。 */
export class LoginController {
  /** 保存当前表单输入数据。 */
  readonly form = reactive<UserLogin>({ userAccount: '', userPassword: '' })
  /** 记录表单提交是否正在执行。 */
  private readonly submitting = ref(false)
  /** 保存会话初始化失败时的内部错误值。 */
  private readonly errorState = ref('')
  /** 只读暴露表单提交是否正在执行。 */
  readonly isSubmitting = readonly(this.submitting)
  /** 保存最近一次加载失败的错误信息。 */
  readonly error = readonly(this.errorState)
  /** 保存登录或注册成功后的回跳地址。 */
  readonly redirectPath = computed(() =>
    safeRedirect(this.route.query.redirect, this.origin, this.base),
  )

  /** 接收登录控制器运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供当前页面的路由参数和查询条件。 */
    private readonly route: Pick<RouteLocationNormalizedLoaded, 'query'>,
    /** 提供页面级会话、路由和通知依赖。 */
    private readonly dependencies: ControllerCommonContext,
    /** 提供控制器所需的后端接口操作。 */
    private readonly api: Pick<UserApi, 'login'>,
    /** 保存服务端应用来源地址。 */
    private readonly origin?: string,
    /** 配置登录成功后回跳地址允许使用的应用根路径。 */
    private readonly base = '/',
  ) {}

  /** 校验表单并提交当前操作。 */
  submit = async (): Promise<void> => {
    if (this.submitting.value) return
    this.errorState.value = ''
    if (!this.form.userAccount || !this.form.userPassword) {
      this.errorState.value = '请输入账号和密码'
      return
    }
    this.submitting.value = true
    try {
      const response = await this.api.login({ ...this.form })
      this.dependencies.session.setLoginUser(response.data.data)
      this.dependencies.notify.success('登录成功')
      await this.dependencies.router.replace(this.redirectPath.value)
    } catch (error) {
      this.errorState.value = errorMessage(error, '登录失败，请稍后重试')
    } finally {
      this.submitting.value = false
    }
  }
}
