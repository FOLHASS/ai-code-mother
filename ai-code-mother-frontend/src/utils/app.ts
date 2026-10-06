import { API_BASE_URL } from '@/request'

// 部署站点由 localhost 提供；生成中的网站仍通过 API 静态资源地址预览。
export const getDeployUrl = (app: Pick<API.AppVO, 'deployKey'>) => {
  const deployKey = app.deployKey?.trim()
  return deployKey ? `http://localhost/${encodeURIComponent(deployKey)}` : ''
}

export const getPreviewUrl = (app: Pick<API.AppVO, 'id' | 'codeGenType'>, cacheBust = false) => {
  if (!app.id || !app.codeGenType) return ''
  const url = `${API_BASE_URL}/static/${app.codeGenType}_${app.id}/`
  return cacheBust ? `${url}?t=${Date.now()}` : url
}

export const formatDate = (date?: string) => {
  if (!date) return '暂无记录'
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('zh-CN')
}

export const formatDateTime = (date?: string, fallback = '-') => {
  if (!date) return fallback
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleString('zh-CN')
}

export const getInitial = (value?: string) => (value || '应').trim().slice(0, 1).toUpperCase()

export const getAppCover = (app?: Pick<API.AppVO, 'cover'> | null) => app?.cover?.trim() || ''
