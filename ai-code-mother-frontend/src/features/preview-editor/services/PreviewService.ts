import { delay } from '@/shared/async/delay.ts'
import { readonly, ref, type Ref } from 'vue'
import type { AppInfo } from '@/shared/domain/models.ts'
import type { PreviewRepository } from './PreviewRepositoryService.ts'
import { LatestRequest } from '@/shared/async/LatestRequest.ts'

/** 管理生成代码的预览地址、加载状态和错误状态。 */
export class PreviewService {
  /** 保存当前网站预览地址。 */
  private readonly url = ref('')
  /** 保存最近一次加载失败的错误信息。 */
  private readonly error = ref('')
  /** 记录预览就绪检查是否正在执行。 */
  private readonly checking = ref(false)
  /** 提供带过期保护的异步请求控制。 */
  private readonly request = new LatestRequest()
  /** 保存当前网站预览页面地址。 */
  readonly previewUrl = readonly(this.url)
  /** 保存预览加载失败时的错误信息。 */
  readonly previewError = readonly(this.error)
  /** 记录预览就绪检查是否正在执行。 */
  readonly isChecking = readonly(this.checking)
  /** 标记网站是否已经生成。 */
  private readonly generated = ref(false)
  /** 标记应用是否已生成可预览的网站。 */
  readonly hasGeneratedWebsite = readonly(this.generated)

  /** 接收网站预览服务运行所需的依赖并初始化状态。 */
  constructor(
    /** 保存当前正在处理的应用数据。 */
    private readonly app: Readonly<Ref<AppInfo | null>>,
    /** 获取当前会话版本，用来丢弃过期的预览检测结果。 */
    private readonly getVersion: () => number,
    /** 提供预览资源查询能力。 */
    private readonly previewApi: PreviewRepository,
  ) {}
  /** 清空预览地址、错误和检查状态。 */
  reset = (): void => {
    this.request.cancel()
    this.url.value = ''
    this.error.value = ''
    this.checking.value = false
    this.generated.value = false
  }
  /** 设置预览地址并启动预览展示流程。 */
  show = async (cacheBust = false): Promise<void> => {
    if (!this.app.value) return
    const version = this.getVersion()
    const request = this.request.begin()
    const url = this.previewApi.getUrl(this.app.value, cacheBust)
    if (!url) {
      this.url.value = ''
      this.generated.value = false
      this.checking.value = false
      this.error.value = '网站预览服务暂不可用，请联系管理员'
      return
    }
    this.checking.value = true
    this.error.value = ''
    try {
      let response = await this.previewApi.checkReady(url, request.signal)
      for (let attempt = 0; cacheBust && response.status === 404 && attempt < 2; attempt++) {
        await delay(400 * (attempt + 1), request.signal)
        response = await this.previewApi.checkReady(url, request.signal)
      }
      if (version !== this.getVersion() || !request.isCurrent()) return
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? '预览文件尚未生成，请稍后刷新重试'
            : `网站预览加载失败（${response.status}）`,
        )
      this.url.value = response.url
      this.generated.value = true
    } catch (error) {
      if (version !== this.getVersion() || !request.isCurrent()) return
      this.url.value = ''
      this.generated.value = false
      this.error.value =
        error instanceof Error && error.name === 'TimeoutError'
          ? '预览检查超时，请刷新重试'
          : error instanceof Error && !(error instanceof TypeError)
            ? error.message
            : '网站预览加载失败，请稍后刷新重试'
    } finally {
      if (request.isCurrent()) this.checking.value = false
    }
  }
}
