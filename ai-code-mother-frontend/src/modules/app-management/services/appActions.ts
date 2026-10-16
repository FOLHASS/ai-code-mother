/**
 * 应用级操作模块：部署返回线上作品 URL，下载从 Blob 响应与 Content-Disposition 提取 ZIP。
 * 两种操作具有独立忙碌标志，共享创建者权限与会话版本，不与预览静态地址混用。
 */
import { ref, type Ref } from 'vue'
import { message } from 'ant-design-vue'

import { deploy, downloadAppCode } from '@/modules/app-management/api/appApi.ts'
import { getDownloadFileName } from '@/utils/download.ts'
import { asApiLongId } from '@/utils/id.ts'

/** 路由 appId 保留大整数原字符串；getVersion 使旧应用的操作结果不再更新当前页面。 */
export type AppActionsContext = {
  app: Ref<API.AppVO | null>
  appId: Ref<string>
  canInteract: Ref<boolean>
  isStreaming: Ref<boolean>
  getVersion: () => number
}

/** 部署和 ZIP 下载共享应用权限，但各自保留独立的忙碌状态。 */
export function useAppActions({ app, appId, canInteract, isStreaming, getVersion }: AppActionsContext) {
  const isDeploying = ref(false)
  const isDownloading = ref(false)
  const deployedUrl = ref('')

  /** 切换应用后丢弃当前操作展示状态；已发出的请求仍由会话版本阻止回写。 */
  const resetActions = () => {
    isDeploying.value = false
    isDownloading.value = false
    deployedUrl.value = ''
  }

  /** 防重复部署并检查创建者身份；成功响应中的地址是后端发布结果，直接交给打开作品入口。 */
  const handleDeploy = async () => {
    if (!app.value?.id || isDeploying.value || isStreaming.value || !canInteract.value) return
    const version = getVersion()
    isDeploying.value = true
    try {
      const response = await deploy({ appId: app.value.id })
      if (version !== getVersion()) return
      if (response.data.code !== 0 || !response.data.data) {
        message.error(response.data.message || '部署失败')
        return
      }
      // 不通过预览 URL 拼部署路径，发布地址以部署接口实际返回值为准。
      deployedUrl.value = response.data.data
      message.success('应用部署成功')
    } catch {
      if (version !== getVersion()) return
      message.error('网络异常，应用部署失败')
    } finally {
      if (version === getVersion()) isDeploying.value = false
    }
  }

  /**
   * 下载接口使用 blob 响应模式，避免 ZIP 被当作 JSON 解码。
   * 同时验证响应类型和非空内容；后端即便返回 HTTP 200 的 JSON 错误，也不能下载成伪 ZIP。
   */
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
      // 响应头由 Axios 归一为小写；Blob 的类型和大小一起校验，确保确有可下载压缩包。
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
      // 文件名优先按服务端 Content-Disposition 解码，解析/缺失时回退到当前应用名称。
      const fileName = getDownloadFileName(
        String(response.headers['content-disposition'] || ''),
        app.value?.appName || '应用代码',
      )
      // 临时对象 URL 交给浏览器下载，不经页面路由；点击后延迟撤销，给浏览器留出读取 Blob 的时间。
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
      // 非 2xx 的 Axios 错误同样可能携带 JSON Blob，读取其中业务 message 还原真实失败原因。
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

  /** 仅打开后端部署结果，禁用新页面对 opener 的访问，并不把站点来源传给目标页面。 */
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

export type AppActions = ReturnType<typeof useAppActions>
