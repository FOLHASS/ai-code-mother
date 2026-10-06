import { API_BASE_URL } from '@/request'

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

export const getInitial = (value?: string) => (value || '应').trim().slice(0, 1).toUpperCase()

export const getAppCover = (app: API.AppVO) => app.cover?.trim() || ''
