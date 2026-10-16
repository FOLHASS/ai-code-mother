/**
 * 应用展示层使用的无状态辅助函数：地址拼接委托全局配置，页面只传入需要的应用字段。
 * 日期、首字和封面函数统一空值处理，避免卡片、管理表格和详情页分别实现不同规则。
 */
import { getDeployUrl as buildDeployUrl, getStaticPreviewUrl } from '@/config/env.ts'

// 部署地址和生成中网站的预览地址分别由全局配置生成。
/** 没有有效 deployKey 时返回空字符串，供调用方隐藏或禁用“查看作品”等入口。 */
export const getDeployUrl = (app: Pick<API.AppVO, 'deployKey'>) => {
  const deployKey = app.deployKey?.trim()
  return deployKey ? buildDeployUrl(deployKey) : ''
}

/**
 * 返回当前生成目录的浏览入口；只有 id 与生成类型都存在才可构造路径。
 * cacheBust 为 true 时附加时间戳，使一轮生成结束后的 iframe 不复用旧页面缓存。
 */
export const getPreviewUrl = (app: Pick<API.AppVO, 'id' | 'codeGenType'>, cacheBust = false) => {
  if (!app.id || !app.codeGenType) return ''
  const url = getStaticPreviewUrl(app.codeGenType, String(app.id))
  return cacheBust ? `${url}?t=${Date.now()}` : url
}

/** 仅展示日期；无法解析的服务端日期字符串原样显示，缺失值使用“暂无记录”。 */
export const formatDate = (date?: string) => {
  if (!date) return '暂无记录'
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('zh-CN')
}

/** 展示本地日期与时间，允许详情等场景自定义缺失值占位文案。 */
export const formatDateTime = (date?: string, fallback = '-') => {
  if (!date) return fallback
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleString('zh-CN')
}

/** 生成无封面时的首字装饰：先使用名称或默认字，再去除两端空白并取首字符。 */
export const getInitial = (value?: string) => (value || '应').trim().slice(0, 1).toUpperCase()

/** 只清理封面字段的两端空白；加载失败时的视觉兜底由 AppCover 处理。 */
export const getAppCover = (app?: Pick<API.AppVO, 'cover'> | null) => app?.cover?.trim() || ''
