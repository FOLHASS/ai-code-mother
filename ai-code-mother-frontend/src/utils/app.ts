import { getDeployUrl as buildDeployUrl, getStaticPreviewUrl } from '@/config/env.ts'

// 部署地址和生成中网站的预览地址分别由全局配置生成。
export const getDeployUrl = (app: Pick<API.AppVO, 'deployKey'>) => {
  const deployKey = app.deployKey?.trim()
  return deployKey ? buildDeployUrl(deployKey) : ''
}

export const getPreviewUrl = (app: Pick<API.AppVO, 'id' | 'codeGenType'>, cacheBust = false) => {
  if (!app.id || !app.codeGenType) return ''
  const url = getStaticPreviewUrl(app.codeGenType, String(app.id))
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
