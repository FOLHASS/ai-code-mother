/**
 * vite 会根据当前模型加载对应的环境变量文件
 */
const env = import.meta.env || {}
export const API_BASE_URL = String(env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')
export const APP_BASE_URL = env.BASE_URL || '/'
export const DEPLOY_DOMAIN = String(env.VITE_DEPLOY_DOMAIN || '').replace(/\/+$/, '')
export const PREVIEW_BASE_URL = String(
  env.VITE_PREVIEW_BASE_URL ||
    (env.DEV
      ? typeof window !== 'undefined' && window.location.hostname === '127.0.0.1'
        ? `http://localhost:${env.VITE_PREVIEW_PORT || 5174}`
        : `http://127.0.0.1:${env.VITE_PREVIEW_PORT || 5174}`
      : ''),
).replace(/\/+$/, '')
export const STREAM_IDLE_TIMEOUT = 90000
export const PREVIEW_TIMEOUT = 10000
export const MAX_ENCODED_PROMPT_LENGTH = 12000

/** 读取当前应用配置的部署入口地址。 */
export const getDeployUrl = (key: string): string =>
  DEPLOY_DOMAIN ? `${DEPLOY_DOMAIN}/${encodeURIComponent(key)}` : ''

/** 读取当前应用配置的静态预览入口地址。 */
export function getStaticPreviewUrl(codeGenType: string, appId: string): string {
  if (!PREVIEW_BASE_URL) return ''
  try {
    const preview = new URL(PREVIEW_BASE_URL)
    if (
      !['http:', 'https:'].includes(preview.protocol) ||
      preview.username ||
      preview.password ||
      preview.pathname !== '/'
    )
      return ''
    if (typeof window !== 'undefined' && preview.hostname === window.location.hostname) return ''
  } catch {
    return ''
  }
  const path = `/api/static/${encodeURIComponent(codeGenType)}_${encodeURIComponent(appId)}/`
  return `${PREVIEW_BASE_URL}${path}`
}
