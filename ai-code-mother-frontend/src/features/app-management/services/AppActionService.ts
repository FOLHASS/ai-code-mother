import { readonly, ref, type Ref } from 'vue'
import type { AppSummary } from '@/shared/domain/models.ts'
import type { Notifier } from '@/shared/ports.ts'
import type { AppRepository } from '../api/AppApiClient.ts'
import type { ArchiveResponse } from '@/shared/ui/downloadArchive.ts'
import { errorMessage } from '@/shared/api/errors.ts'

export type AppActionsContext = {
  app: Readonly<Ref<AppSummary | null>>
  canDeploy: Readonly<Ref<boolean>>
  canDownload: Readonly<Ref<boolean>>
  isStreaming: Readonly<Ref<boolean>>
  getVersion: () => number
}
/** 执行应用部署、代码下载和线上地址打开等操作。 */
export class AppActionService {
  /** 记录应用部署是否正在执行。 */
  private readonly deploying = ref(false)
  /** 记录应用代码下载是否正在执行。 */
  private readonly downloading = ref(false)
  /** 保存当前应用的部署地址。 */
  private readonly url = ref('')
  /** 只读暴露应用部署是否正在执行。 */
  readonly isDeploying = readonly(this.deploying)
  /** 只读暴露应用代码下载是否正在执行。 */
  readonly isDownloading = readonly(this.downloading)
  /** 保存应用成功部署后的地址。 */
  readonly deployedUrl = readonly(this.url)
  /** 接收应用操作服务运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供当前业务流程使用的共享状态和回调。 */
    private readonly context: AppActionsContext,
    /** 提供控制器所需的后端接口操作。 */
    private readonly api: Pick<AppRepository, 'deploy' | 'downloadCode'>,
    /** 提供成功、失败等界面通知能力。 */
    private readonly notify: Notifier,
    /** 保存下载归档的异步操作。 */
    private readonly saveArchive: (response: ArchiveResponse, name: string) => Promise<void>,
    /** 在浏览器中打开部署地址的操作。 */
    private readonly openUrl: (url: string) => void,
  ) {}

  /** 清除上一次部署地址和操作状态。 */
  reset = (): void => {
    this.deploying.value = false
    this.downloading.value = false
    this.url.value = ''
  }
  /** 记录部署完成后返回的线上地址。 */
  setDeployedUrl = (url: string): void => {
    this.url.value = url
  }
  /** 部署当前应用代码并保存部署结果。 */
  deploy = async (): Promise<void> => {
    const { app, canDeploy, isStreaming, getVersion } = this.context
    if (!app.value || !canDeploy.value || isStreaming.value || this.deploying.value) return
    const version = getVersion()
    this.deploying.value = true
    try {
      const response = await this.api.deploy({ appId: app.value.id })
      if (version !== getVersion()) return
      this.url.value = response.data.data
      this.notify.success('应用部署成功')
    } catch (error) {
      if (version === getVersion()) this.notify.error(errorMessage(error))
    } finally {
      if (version === getVersion()) this.deploying.value = false
    }
  }
  /** 下载当前应用的源代码归档。 */
  download = async (): Promise<void> => {
    const { app, canDownload, isStreaming, getVersion } = this.context
    if (!app.value || !canDownload.value || isStreaming.value || this.downloading.value) return
    const version = getVersion()
    const name = app.value.appName || '应用代码'
    this.downloading.value = true
    try {
      const response = await this.api.downloadCode({ appId: app.value.id })
      if (version === getVersion()) await this.saveArchive(response, name)
    } catch (error) {
      if (version === getVersion()) this.notify.error(errorMessage(error))
    } finally {
      if (version === getVersion()) this.downloading.value = false
    }
  }
  /** 在新页面打开已部署的应用。 */
  openDeployed = (): void => {
    if (this.url.value) this.openUrl(this.url.value)
  }
}
