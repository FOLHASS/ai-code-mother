/** Shared date presentation helpers used by feature UI modules. */
export const formatDateTime = (date?: string, fallback = '-') => {
  if (!date) return fallback
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleString('zh-CN')
}

export const formatDate = (date?: string) => {
  if (!date) return '暂无记录'
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('zh-CN')
}
