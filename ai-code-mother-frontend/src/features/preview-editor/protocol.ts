import type { ElementInfo } from '@/shared/domain/element.ts'
export const EDITOR_SOURCE = 'ai-code-mother-visual-editor'
/** 判断未知值是否为普通对象记录。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
/** 判断消息数据是否符合预览元素信息结构。 */
export function isElementInfo(value: unknown): value is ElementInfo {
  if (!isRecord(value) || !isRecord(value.rect)) return false
  const limits = {
    tagName: 64,
    id: 512,
    className: 1024,
    textContent: 500,
    selector: 4096,
    pagePath: 2048,
  }
  for (const [key, limit] of Object.entries(limits))
    if (typeof value[key] !== 'string' || value[key].length > limit) return false
  if (!value.tagName || !value.selector) return false
  const rect = value.rect
  return ['top', 'left', 'width', 'height'].every(
    (key) =>
      typeof rect[key] === 'number' &&
      Number.isFinite(rect[key]) &&
      (!['width', 'height'].includes(key) || rect[key] >= 0),
  )
}
