/**
 * 生成文件预览的状态所有者：先探测静态页面，再把 URL 提供给 iframe。
 * 同时使用应用版本和本地检查序号，应对应用切换以及同一应用连续刷新之间的响应竞态。
 */
import { ref, type Ref } from 'vue'

import { getPreviewUrl } from '@/utils/app.ts'

/** 预览的就绪检测与过期请求隔离。 */
export function usePreview(app: Ref<API.AppVO | null>, getVersion: () => number) {
  const previewUrl = ref('')
  const previewError = ref('')
  const hasGeneratedWebsite = ref(false)
  // 同一应用内后发的刷新优先；仅应用版本不足以区分连续两次 HEAD 检查。
  let previewCheckId = 0
  let previewController: AbortController | null = null

  /** 重置时递增检测序号，使此前尚未完成的检查即便返回成功也无法重新显示旧预览。 */
  const resetPreview = () => {
    previewCheckId += 1
    previewController?.abort()
    previewController = null
    previewUrl.value = ''
    previewError.value = ''
    hasGeneratedWebsite.value = false
  }

  /**
   * cacheBust 用于生成完成或手动刷新后的重新读取；地址构造交给统一的应用工具。
   * 仅探测 HEAD，不把整个生成页面内容加载到宿主应用中。
   */
  const showPreview = async (cacheBust = false) => {
    if (!app.value) return
    const version = getVersion()
    const url = getPreviewUrl(app.value, cacheBust)
    if (!url) return
    const checkId = ++previewCheckId
    previewController?.abort()
    const controller = new AbortController()
    previewController = controller
    previewError.value = ''
    try {
      // 对话历史条数不能代表构建成功；确认静态页面存在后再显示 iframe。
      // 使用现有会话凭据并绕过缓存，避免旧的 404 或旧构建掩盖本次生成结果。
      const response = await fetch(url, {
        method: 'HEAD',
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      })
      // 两层失效检查同时通过才提交结果：既属于当前应用，也是当前最新一次预览检查。
      if (version !== getVersion() || checkId !== previewCheckId) return
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? '预览文件尚未生成，请完成代码生成后重试'
            : `网站预览加载失败（${response.status}），请刷新重试`,
        )
      }
      // URL 与就绪状态同时更新，iframe 仅在已通过探测时进入展示分支。
      previewUrl.value = url
      hasGeneratedWebsite.value = true
    // HTTP 失败保留具体提示；浏览器网络错误转换成用户可理解的后端可用性提示。
    } catch (error) {
      if (version !== getVersion() || checkId !== previewCheckId) return
      previewUrl.value = ''
      hasGeneratedWebsite.value = false
      previewError.value =
        error instanceof Error && !(error instanceof TypeError)
          ? error.message
          : '网站预览加载失败，请确认后端服务可用后重试'
    } finally {
      if (checkId === previewCheckId && previewController === controller) {
        previewController = null
      }
    }
  }

  return { previewUrl, previewError, hasGeneratedWebsite, showPreview, resetPreview }
}

export const useAppPreview = usePreview
export type PreviewContext = Parameters<typeof usePreview>[0]
export type PreviewComposable = ReturnType<typeof usePreview>
