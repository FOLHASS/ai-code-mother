import { createAbortScope } from '@/shared/async/AbortScope.ts'
import type { AppInfo } from '@/shared/domain/models.ts'
import { getPreviewUrl } from '@/utils/app.ts'
import { PREVIEW_TIMEOUT } from '@/config/env.ts'

export type PreviewCheckResult = { url: string; ok: boolean; status: number }
export type PreviewRepository = {
  getUrl: (app: AppInfo, cacheBust?: boolean) => string
  checkReady: (url: string, signal?: AbortSignal) => Promise<PreviewCheckResult>
}

/**
 * 定位预览资源地址并检查预览入口是否就绪。
 */
export class PreviewRepositoryService implements PreviewRepository {
  /** 接收预览资源仓储服务运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供可替换的网络请求实现。 */
    private readonly fetcher: typeof fetch = fetch,
    /** 设置预览就绪检查的超时时间。 */
    private readonly timeout = PREVIEW_TIMEOUT,
  ) {}

  /**
   * 构造当前应用预览资源的访问地址
   * @param app
   * @param cacheBust 是否带上时间戳，避免使用浏览器缓存的旧资源
   */
  getUrl = (app: AppInfo, cacheBust = false): string => getPreviewUrl(app, cacheBust)

  /**
   * 请求预览入口并判断其是否已就绪
   * @param url
   * @param signal
   */
  async checkReady(url: string, signal?: AbortSignal): Promise<PreviewCheckResult> {
    const request = createAbortScope(signal, this.timeout)
    try {
      const fetcher = this.fetcher
      const options: RequestInit = {
        method: 'HEAD',
        credentials: 'omit',
        cache: 'no-store',
        signal: request.signal,
      }
      let response = await fetcher(url, options)
      // New Vue previews are published at the app root; older apps use workspace/dist.
      const preview = new URL(url)
      if (response.status === 404 && /\/api\/static\/vue_project_[^/]+\/$/.test(preview.pathname)) {
        // 如果找不到资源， 去找默认的目录
        preview.pathname += 'dist/index.html'
        url = preview.href
        response = await fetcher(url, options)
      }
      return { url, ok: response.ok, status: response.status }
    } catch (error) {
      if (request.signal.aborted) throw request.reason
      throw error
    } finally {
      request.dispose()
    }
  }
}
