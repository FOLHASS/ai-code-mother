/** 为各业务功能提供统一的日期展示格式化方法。 */
export const formatDateTime = (date?: string, fallback = '-') => {
  if (!date) return fallback
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleString('zh-CN')
}

/** 把日期值格式化为界面使用的日期文本。 */
export const formatDate = (date?: string) => {
  if (!date) return '暂无记录'
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('zh-CN')
}
