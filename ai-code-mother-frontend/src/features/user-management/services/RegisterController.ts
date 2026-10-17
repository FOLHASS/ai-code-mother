import { computed, reactive, readonly, ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { UserRegister } from '@/shared/domain/models.ts'
import type { PageDependencies } from '@/shared/ports.ts'
import type { UserRepository } from '../api/UserApiClient.ts'
import { safeRedirect } from '@/shared/routing/redirect.ts'
import { errorMessage } from '@/shared/api/errors.ts'

/** 管理注册表单校验、提交和注册后回跳。 */
export class RegisterController {
  /** 保存当前表单输入数据。 */
  readonly form = reactive<UserRegister>({ userAccount: '', userPassword: '', checkPassword: '' })
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

  /** 接收注册控制器运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供当前页面的路由参数和查询条件。 */
    private readonly route: Pick<RouteLocationNormalizedLoaded, 'query'>,
    /** 提供页面级会话、路由和通知依赖。 */
    private readonly dependencies: PageDependencies,
    /** 提供控制器所需的后端接口操作。 */
    private readonly api: Pick<UserRepository, 'register'>,
    /** 保存服务端应用来源地址。 */
    private readonly origin?: string,
    /** 配置注册成功后回跳地址允许使用的应用根路径。 */
    private readonly base = '/',
  ) {}

  /** 校验注册表单字段并返回校验结果。 */
  validate = (): string => {
    const account = this.form.userAccount?.trim() || ''
    const password = this.form.userPassword || ''
    if (!account || !password || !this.form.checkPassword) return '请完整填写注册信息'
    if (account.length < 4 || account.length > 20) return '账号长度需为 4-20 个字符'
    if (password.length < 8 || password.length > 20) return '密码长度需为 8-20 个字符'
    return password === this.form.checkPassword ? '' : '两次输入的密码不一致'
  }

  /** 校验表单并提交当前操作。 */
  submit = async (): Promise<void> => {
    if (this.submitting.value) return
    this.errorState.value = this.validate()
    if (this.errorState.value) return
    this.submitting.value = true
    try {
      await this.api.register({ ...this.form, userAccount: this.form.userAccount?.trim() })
      this.dependencies.notify.success('注册成功，请登录')
      await this.dependencies.router.replace({
        path: '/user/login',
        query: { redirect: this.redirectPath.value },
      })
    } catch (error) {
      this.errorState.value = errorMessage(error, '注册失败，请稍后重试')
    } finally {
      this.submitting.value = false
    }
  }
}
