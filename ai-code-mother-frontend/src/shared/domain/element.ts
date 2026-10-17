/** 在聊天输入区和预览功能间传递的有限元素快照。 */
export type ElementInfo = {
  tagName: string
  id: string
  className: string
  textContent: string
  selector: string
  pagePath: string
  rect: { top: number; left: number; width: number; height: number }
}
