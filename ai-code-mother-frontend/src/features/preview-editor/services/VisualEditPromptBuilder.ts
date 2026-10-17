import { CodeGenTypeEnum } from '@/utils/codeGenTypes.ts'
import type { ElementInfo } from '@/shared/domain/element.ts'

/** 从预览页面选中元素构造长度受控的编辑提示词上下文。 */
export class VisualEditPromptBuilder {
  /** 计算提示词经过传输编码后的长度。 */
  private encodedLength(value: string): number {
    return encodeURIComponent(value).length
  }

  /** 在长度限制内缩短可视化编辑提示词。 */
  private shorten(value: string, budget: number): string {
    if (this.encodedLength(JSON.stringify(value)) <= budget) return value
    const characters = Array.from(value)
    let start = 0
    let end = characters.length
    while (start < end) {
      const middle = Math.ceil((start + end) / 2)
      if (this.encodedLength(JSON.stringify(`${characters.slice(0, middle).join('')}…`)) <= budget)
        start = middle
      else end = middle - 1
    }
    return `${characters.slice(0, start).join('')}…`
  }

  /** 构造包含元素上下文的可视化编辑提示词。 */
  build(message: string, element: ElementInfo | null): string {
    if (!element) return message
    const { pagePath: previewPagePath, selector, tagName, id, className, textContent } = element
    const pagePath = previewPagePath.replace(
      new RegExp(`^([^?#]*/${CodeGenTypeEnum.VUE_PROJECT}_[^/?#]+)/dist(?=/|[?#]|$)`),
      '$1',
    )
    const context: Record<string, string> = {
      pagePath,
      selector,
      tagName,
      textContent: Array.from(textContent).slice(0, 100).join(''),
    }
    if (id && !selector.includes(id)) context.id = id
    if (className && !className.split(/\s+/).every((name) => selector.includes(`.${name}`)))
      context.className = className
    const serialize = () =>
      `\n\n【可视化编辑目标】\n${JSON.stringify(context)}\n结合页面路径、选择器与元素文本修改选中元素。`

    if (this.encodedLength(serialize()) > 3500) {
      delete context.id
      delete context.className
      context.pagePath = this.shorten(pagePath, 900)
      context.textContent = this.shorten(context.textContent ?? '', 400)
      const safeTag = /^[a-zA-Z][\w-]*$/.test(tagName) ? tagName.toLowerCase() : '*'
      context.tagName = safeTag
      if (this.encodedLength(JSON.stringify(selector)) > 1200) context.selector = safeTag
      if (context.pagePath !== pagePath || context.selector !== selector) {
        context.locatorNote = '过长定位信息已精简，请结合元素文本定位。'
      }
      if (this.encodedLength(serialize()) > 3500) {
        context.selector = safeTag
        context.pagePath = this.shorten(pagePath, 500)
        context.locatorNote = '定位范围已精简，请结合元素文本定位。'
      }
    }
    return `${message}${serialize()}`
  }
}
