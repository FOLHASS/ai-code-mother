import { nextTick } from 'vue'

/** 由工作台管理聊天容器 DOM，并负责滚动位置的计算与恢复。 */
export class ChatScrollController {
  /** 保存预览页面当前选中的元素信息。 */
  private element: HTMLElement | null = null
  /** 用递增版本号识别并忽略过期请求结果。 */
  private version = 0
  /** 绑定聊天滚动容器及其滚动事件。 */
  attach = (element: HTMLElement | null): void => {
    this.element = element
  }
  /** 清空当前流程状态并恢复初始值。 */
  reset = (): void => {
    this.version += 1
  }
  /** 取消未完成任务并释放控制器持有的资源。 */
  dispose = (): void => {
    this.reset()
    this.element = null
  }
  /** 将聊天容器滚动到最新消息位置。 */
  bottom = async (force = false): Promise<void> => {
    const list = this.element
    const version = this.version
    if (!list || (!force && list.scrollHeight - list.scrollTop - list.clientHeight >= 80)) return
    await nextTick()
    if (list === this.element && version === this.version) list.scrollTop = list.scrollHeight
  }
  /** 记录当前阅读位置，便于消息更新后恢复滚动位置。 */
  captureAnchor = (): (() => Promise<void>) => {
    const list = this.element
    const version = this.version
    const height = list?.scrollHeight || 0,
      top = list?.scrollTop || 0
    const anchor = list?.querySelector<HTMLElement>('.message-row')
    const anchorTop = anchor?.getBoundingClientRect().top
    return async () => {
      await nextTick()
      if (!list || list !== this.element || version !== this.version) return
      list.scrollTop = Math.max(
        0,
        top +
          (anchor?.isConnected && anchorTop !== undefined
            ? anchor.getBoundingClientRect().top - anchorTop
            : list.scrollHeight - height),
      )
    }
  }
}
