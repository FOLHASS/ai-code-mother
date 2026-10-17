/** 以兼容浏览器的方式组合取消信号并管理异步任务截止时间。 */
export function createAbortScope(parent?: AbortSignal, timeout?: number, timeoutReason?: Error) {
  const controller = new AbortController()
  let reason: unknown
  let timer: ReturnType<typeof setTimeout> | undefined
  const abort = (value?: unknown) => {
    if (controller.signal.aborted) return
    reason = value || Object.assign(new Error('请求已取消'), { name: 'AbortError' })
    clearTimeout(timer)
    controller.abort(reason)
  }
  const fromParent = () => abort(parent?.reason)
  if (parent?.aborted) fromParent()
  else parent?.addEventListener('abort', fromParent, { once: true })
  const refreshDeadline = () => {
    clearTimeout(timer)
    if (timeout !== undefined && !controller.signal.aborted) {
      timer = setTimeout(
        () =>
          abort(timeoutReason || Object.assign(new Error('请求超时'), { name: 'TimeoutError' })),
        timeout,
      )
    }
  }
  refreshDeadline()
  return {
    signal: controller.signal,
    get reason() {
      return reason
    },
    refreshDeadline,
    dispose: () => {
      clearTimeout(timer)
      parent?.removeEventListener('abort', fromParent)
    },
  }
}
