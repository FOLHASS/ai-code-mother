import { ref, type Ref } from 'vue'

import { getPreviewUrl } from '@/utils/app.ts'

/** 预览的就绪检测与过期请求隔离。 */
export function useAppPreview(app: Ref<API.AppVO | null>, getVersion: () => number) {
  const previewUrl = ref('')
  const previewError = ref('')
  const hasGeneratedWebsite = ref(false)
  let previewCheckId = 0

  const resetPreview = () => {
    previewCheckId += 1
    previewUrl.value = ''
    previewError.value = ''
    hasGeneratedWebsite.value = false
  }

  const showPreview = async (cacheBust = false) => {
    if (!app.value) return
    const version = getVersion()
    const url = getPreviewUrl(app.value, cacheBust)
    if (!url) return
    const checkId = ++previewCheckId
    previewError.value = ''
    try {
      // 对话历史条数不能代表构建成功；确认静态页面存在后再显示 iframe。
      const response = await fetch(url, {
        method: 'HEAD',
        credentials: 'include',
        cache: 'no-store',
      })
      if (version !== getVersion() || checkId !== previewCheckId) return
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? '预览文件尚未生成，请完成代码生成后重试'
            : `网站预览加载失败（${response.status}），请刷新重试`,
        )
      }
      previewUrl.value = url
      hasGeneratedWebsite.value = true
    } catch (error) {
      if (version !== getVersion() || checkId !== previewCheckId) return
      previewUrl.value = ''
      hasGeneratedWebsite.value = false
      previewError.value =
        error instanceof Error && !(error instanceof TypeError)
          ? error.message
          : '网站预览加载失败，请确认后端服务可用后重试'
    }
  }

  return { previewUrl, previewError, hasGeneratedWebsite, showPreview, resetPreview }
}
