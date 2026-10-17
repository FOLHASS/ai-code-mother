/** 取消底层请求，并使尚未结束的旧请求结果失效。 */
export class LatestRequest {
  /** 用递增版本号识别并忽略过期请求结果。 */
  private version = 0
  /** 持有当前生成请求的中止控制器。 */
  private controller: AbortController | null = null

  /** 开始一轮新请求并使之前的请求失效。 */
  begin() {
    this.cancel()
    const version = this.version
    const controller = new AbortController()
    this.controller = controller
    return {
      signal: controller.signal,
      isCurrent: () => version === this.version && !controller.signal.aborted,
    }
  }

  /** 取消当前请求并使其结果不再生效。 */
  cancel = (): void => {
    this.version += 1
    this.controller?.abort()
    this.controller = null
  }
}
