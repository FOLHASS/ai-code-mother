/** 携带接口错误码和 HTTP 状态的标准化异常。 */
export class ApiError extends Error {
  /** 接收接口错误对象运行所需的依赖并初始化状态。 */
  constructor(
    message: string,
    /** 保存接口返回的业务错误码。 */
    readonly code?: number,
    /** 只读暴露当前会话状态。 */
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** 判断错误是否代表登录凭证失效。 */
export function isAuthenticationError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 40100 || error.status === 401)
}

/** 提取适合界面展示的错误消息。 */
export function errorMessage(error: unknown, fallback = '请求失败，请稍后重试'): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** 判断错误是否由请求取消引起。 */
export function isCancellation(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'CanceledError' || error.name === 'TimeoutError')
  )
}
