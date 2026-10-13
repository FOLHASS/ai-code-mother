import { ref, type Ref } from 'vue'
import { message } from 'ant-design-vue'

import { deploy, downloadAppCode } from '@/api/appController.ts'
import { getDownloadFileName } from '@/utils/download.ts'
import { asApiLongId } from '@/utils/id.ts'

type ActionContext = {
  app: Ref<API.AppVO | null>
  appId: Ref<string>
  canInteract: Ref<boolean>
  isStreaming: Ref<boolean>
  getVersion: () => number
}

/** 部署和 ZIP 下载共享应用权限，但各自保留独立的忙碌状态。 */
export function useAppActions({ app, appId, canInteract, isStreaming, getVersion }: ActionContext) {
  const isDeploying = ref(false)
  const isDownloading = ref(false)
  const deployedUrl = ref('')

  const resetActions = () => {
    isDeploying.value = false
    isDownloading.value = false
    deployedUrl.value = ''
  }

  const handleDeploy = async () => {
    if (!app.value?.id || isDeploying.value || !canInteract.value) return
    const version = getVersion()
    isDeploying.value = true
    try {
      const response = await deploy({ appId: app.value.id })
      if (version !== getVersion()) return
      if (response.data.code !== 0 || !response.data.data) {
        message.error(response.data.message || '部署失败')
        return
      }
      deployedUrl.value = response.data.data
      message.success('应用部署成功')
    } catch {
      if (version !== getVersion()) return
      message.error('网络异常，应用部署失败')
    } finally {
      if (version === getVersion()) isDeploying.value = false
    }
  }

  const handleDownload = async () => {
    if (!app.value?.id || !canInteract.value || isStreaming.value || isDownloading.value) return
    const version = getVersion()
    isDownloading.value = true
    try {
      // 生成的接口将 Long 声明为 number，运行时传入路由原始字符串，避免大 ID 精度丢失。
      const response = await downloadAppCode(
        { appId: asApiLongId(appId.value) },
        { responseType: 'blob' },
      )
      if (version !== getVersion()) return
      const archive = response.data as Blob
      const contentType = String(response.headers['content-type'] || '').toLowerCase()
      if (!(archive instanceof Blob) || !contentType.includes('application/zip') || !archive.size) {
        let reason = '下载代码失败，请稍后重试'
        if (archive instanceof Blob && contentType.includes('application/json')) {
          try {
            reason = (JSON.parse(await archive.text()) as { message?: string }).message || reason
          } catch {
            // 非 JSON 错误响应沿用通用提示。
          }
        }
        throw new Error(reason)
      }
      const fileName = getDownloadFileName(
        String(response.headers['content-disposition'] || ''),
        app.value?.appName || '应用代码',
      )
      const url = URL.createObjectURL(archive)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      if (version !== getVersion()) return
      let reason = error instanceof Error ? error.message : '下载代码失败，请稍后重试'
      const errorBody = (error as { response?: { data?: unknown } })?.response?.data
      if (errorBody instanceof Blob && errorBody.type.includes('application/json')) {
        try {
          reason = (JSON.parse(await errorBody.text()) as { message?: string }).message || reason
        } catch {
          // 下载错误响应不是 JSON 时沿用请求错误信息。
        }
      }
      message.error(reason)
    } finally {
      if (version === getVersion()) isDownloading.value = false
    }
  }

  const openDeployUrl = () => {
    if (deployedUrl.value) window.open(deployedUrl.value, '_blank', 'noopener,noreferrer')
  }

  return {
    isDeploying,
    isDownloading,
    deployedUrl,
    resetActions,
    handleDeploy,
    handleDownload,
    openDeployUrl,
  }
}
