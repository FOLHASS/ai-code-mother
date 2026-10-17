import type { ElementInfo } from '@/shared/domain/element.ts'
import { EDITOR_SOURCE, isElementInfo, isRecord } from '../protocol.ts'
export type { ElementInfo } from '@/shared/domain/element.ts'

export type VisualEditorOptions = {
  onElementSelected?: (element: ElementInfo) => void
  onElementHover?: (element: ElementInfo) => void
  onSelectionCleared?: () => void
  onReady?: (ready: boolean) => void
  onError?: (error: Error) => void
}

/** 管理宿主页面与预览 iframe 之间的消息通信。 */
export class VisualEditor {
  /** 保存预览页面的 iframe 元素引用。 */
  private iframe: HTMLIFrameElement | null = null
  /** 保存服务端应用来源地址。 */
  private origin = ''
  /** 保存与预览 iframe 通信使用的频道标识。 */
  private channel = ''
  /** 标记预览编辑器通信是否已经就绪。 */
  private ready = false
  /** 记录预览页面是否处于元素编辑状态。 */
  private editing = false
  /** 保存预览检查的超时计时器。 */
  private timer: ReturnType<typeof setTimeout> | undefined
  /** 保存 iframe 消息监听器，便于销毁时移除。 */
  private readonly messageListener = (event: MessageEvent) => this.handleIframeMessage(event)
  /** 保存 iframe 加载监听器，便于销毁时移除。 */
  private readonly loadListener = () => this.onIframeLoad()
  /** 接收可视化编辑器通信桥运行所需的依赖并初始化状态。 */
  constructor(/** 提供编辑器运行所需的配置选项。 */
  private readonly options: VisualEditorOptions = {}) {}

  /** 注册 iframe 消息监听并启动编辑器握手。 */
  init(iframe: HTMLIFrameElement): void {
    this.destroy()
    try {
      const target = new URL(iframe.src, window.location.href)
      if (
        !['http:', 'https:'].includes(target.protocol) ||
        target.origin === window.location.origin ||
        target.hostname === window.location.hostname
      ) {
        throw new Error('网站预览需要使用独立的预览服务')
      }
      this.iframe = iframe
      this.origin = target.origin
      window.addEventListener('message', this.messageListener)
      iframe.addEventListener('load', this.loadListener)
      this.handshake()
    } catch (error) {
      this.options.onError?.(error instanceof Error ? error : new Error('预览服务连接失败'))
    }
  }
  /** 与预览 iframe 确认通信桥已就绪。 */
  private handshake(): void {
    clearTimeout(this.timer)
    this.ready = false
    this.editing = false
    this.options.onReady?.(false)
    this.options.onSelectionCleared?.()
    this.channel = crypto.randomUUID()
    this.post('INIT')
    this.timer = setTimeout(() => {
      if (!this.ready) this.options.onError?.(new Error('预览编辑暂不可用，请刷新网站预览重试'))
    }, 8000)
  }
  /** 向预览 iframe 发送结构化编辑消息。 */
  private post(type: string): void {
    this.iframe?.contentWindow?.postMessage(
      { source: EDITOR_SOURCE, channel: this.channel, type },
      this.origin,
    )
  }
  /** 在 iframe 加载完成后重新建立通信。 */
  onIframeLoad(): void {
    this.handshake()
  }
  /** 通知预览页面启用元素选择模式。 */
  enableEditMode(): boolean {
    if (!this.ready) return false
    this.post('ENABLE')
    this.editing = true
    return true
  }
  /** 通知预览页面退出元素选择模式。 */
  disableEditMode(): void {
    if (this.ready) this.post('DISABLE')
    this.editing = false
    this.options.onSelectionCleared?.()
  }
  /** 清除当前选中元素及其编辑提示信息。 */
  clearSelection(): void {
    if (this.ready) this.post('CLEAR')
    this.options.onSelectionCleared?.()
  }
  /** 验证并处理来自预览 iframe 的消息。 */
  handleIframeMessage(event: MessageEvent): void {
    if (!this.iframe || event.source !== this.iframe.contentWindow || event.origin !== this.origin)
      return
    const value: unknown = event.data
    if (!isRecord(value) || value.source !== EDITOR_SOURCE || value.channel !== this.channel) return
    if (value.type === 'READY') {
      clearTimeout(this.timer)
      this.ready = true
      this.options.onReady?.(true)
      return
    }
    if (!this.ready || !this.editing) return
    if (value.type === 'SELECTION_CLEARED') {
      this.options.onSelectionCleared?.()
      return
    }
    if (!isRecord(value.data) || !isElementInfo(value.data.elementInfo)) return
    if (value.type === 'ELEMENT_SELECTED') this.options.onElementSelected?.(value.data.elementInfo)
    else if (value.type === 'ELEMENT_HOVER') this.options.onElementHover?.(value.data.elementInfo)
  }
  /** 移除监听器并释放关联资源。 */
  destroy(): void {
    clearTimeout(this.timer)
    this.disableEditMode()
    this.iframe?.removeEventListener('load', this.loadListener)
    if (typeof window !== 'undefined') window.removeEventListener('message', this.messageListener)
    this.iframe = null
    this.origin = ''
    this.channel = ''
    this.ready = false
    this.options.onReady?.(false)
  }
}
