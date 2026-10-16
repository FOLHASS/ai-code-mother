/** 用户在预览网站中选中的元素，供对话提示词定位修改目标。 */
export interface ElementInfo {
  tagName: string
  id: string
  className: string
  textContent: string
  selector: string
  pagePath: string
  rect: { top: number; left: number; width: number; height: number }
}

export interface VisualEditorOptions {
  onElementSelected?: (elementInfo: ElementInfo) => void
  onElementHover?: (elementInfo: ElementInfo) => void
  onSelectionCleared?: () => void
  onError?: (error: Error) => void
}

interface IframeEditorBridge {
  channel: string
  enable: () => void
  disable: () => void
  clearSelection: () => void
  destroy: () => void
}

type EditorWindow = Window & { __aiCodeMotherVisualEditor?: IframeEditorBridge }

const MESSAGE_SOURCE = 'ai-code-mother-visual-editor'
let editorSequence = 0

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 校验 iframe 发来的数据，避免其他窗口消息或异常数据影响聊天状态。 */
function isElementInfo(value: unknown): value is ElementInfo {
  if (!isRecord(value) || !isRecord(value.rect)) return false
  const limits = {
    tagName: 64,
    id: 512,
    className: 1024,
    textContent: 500,
    selector: 4096,
    pagePath: 2048,
  }
  for (const [key, limit] of Object.entries(limits)) {
    const field = value[key]
    if (typeof field !== 'string' || field.length > limit) return false
  }
  if (!value.tagName || !value.selector) return false
  const rect = value.rect
  return ['top', 'left', 'width', 'height'].every((key) => {
    const field = rect[key]
    return (
      typeof field === 'number' &&
      Number.isFinite(field) &&
      (!['width', 'height'].includes(key) || field >= 0)
    )
  })
}

function encodedLength(value: string): number {
  return encodeURIComponent(value).length
}

/** 按实际 URL 编码长度控制上下文大小，不切断 Unicode 字符。 */
function shortenContextText(value: string, budget: number): string {
  if (encodedLength(JSON.stringify(value)) <= budget) return value
  const characters = Array.from(value)
  let start = 0
  let end = characters.length
  while (start < end) {
    const middle = Math.ceil((start + end) / 2)
    if (encodedLength(JSON.stringify(`${characters.slice(0, middle).join('')}…`)) <= budget)
      start = middle
    else end = middle - 1
  }
  return `${characters.slice(0, start).join('')}…`
}

/** 保留用户输入，将精简定位上下文追加到提示词，避免现有 GET 流式接口 URL 过长。 */
export function buildVisualEditPrompt(message: string, element: ElementInfo | null): string {
  if (!element) return message
  const { pagePath, selector, tagName, id, className, textContent } = element
  const context: Record<string, string> = {
    pagePath,
    selector,
    tagName,
    textContent: Array.from(textContent).slice(0, 100).join(''),
  }
  // selector 已包含的信息不用再次发送。
  if (id && !selector.includes(id)) context.id = id
  if (className && !className.split(/\s+/).every((name) => selector.includes(`.${name}`)))
    context.className = className
  const serialize = () =>
    `\n\n【可视化编辑目标】\n${JSON.stringify(context)}\n结合页面路径、选择器与元素文本修改选中元素。`
  if (encodedLength(serialize()) > 3500) {
    delete context.id
    delete context.className
    context.pagePath = shortenContextText(pagePath, 900)
    context.textContent = shortenContextText(context.textContent ?? '', 400)
    const safeTag = /^[a-zA-Z][\w-]*$/.test(tagName) ? tagName.toLowerCase() : '*'
    context.tagName = safeTag
    if (encodedLength(JSON.stringify(selector)) > 1200) context.selector = safeTag
    if (context.pagePath !== pagePath || context.selector !== selector) {
      context.locatorNote = '过长定位信息已精简，请结合元素文本定位。'
    }
    if (encodedLength(serialize()) > 3500) {
      context.selector = safeTag
      context.pagePath = shortenContextText(pagePath, 500)
      context.locatorNote = '定位范围已精简，请结合元素文本定位。'
    }
  }
  return `${message}${serialize()}`
}

/**
 * 此函数序列化后在 iframe 内执行，必须保持独立，不能引用模块外的运行时变量。
 * 高亮使用独立覆盖层，不修改生成网站的样式、class 或布局。
 */
function installIframeEditor(channel: string, parentOrigin: string) {
  const editorWindow = window as EditorWindow
  editorWindow.__aiCodeMotherVisualEditor?.destroy()
  let enabled = false
  let hovered: Element | null = null
  let selected: Element | null = null
  let hoverOverlay: HTMLDivElement | null = null
  let selectedOverlay: HTMLDivElement | null = null

  const emit = (type: string, element?: Element) => {
    window.parent.postMessage(
      {
        source: 'ai-code-mother-visual-editor',
        channel,
        type,
        data: element ? { elementInfo: getElementInfo(element) } : undefined,
      },
      parentOrigin,
    )
  }

  const escapeIdentifier = (value: string) =>
    window.CSS?.escape
      ? window.CSS.escape(value)
      : Array.from(value)
          .map((character, index) =>
            /[a-zA-Z_-]/.test(character) || (index > 0 && /[0-9]/.test(character))
              ? character
              : `\\${character.codePointAt(0)?.toString(16)} `,
          )
          .join('')

  const getSelector = (element: Element) => {
    // 优先使用短而唯一的 ID，避免重复 class 和无意义的 nth-child 组合。
    if (element.id) {
      const idSelector = `#${escapeIdentifier(element.id)}`
      if (
        encodeURIComponent(JSON.stringify(idSelector)).length <= 1000 &&
        document.querySelectorAll(idSelector).length === 1
      )
        return idSelector
    }
    const parts: string[] = []
    let current: Element | null = element
    let fallback = escapeIdentifier(element.localName)
    while (current) {
      let part = escapeIdentifier(current.localName)
      if (current.parentElement) {
        part += `:nth-child(${Array.from(current.parentElement.children).indexOf(current) + 1})`
      }
      parts.unshift(part)
      const selector = parts.join(' > ')
      // 过深 DOM 使用完整的局部祖先链，不能截断 CSS 产生无效选择器。
      if (selector.length > 1024) break
      fallback = selector
      if (document.querySelectorAll(selector).length === 1) return selector
      current = current.parentElement
    }
    return fallback
  }

  const getElementInfo = (element: Element): ElementInfo => {
    const rect = element.getBoundingClientRect()
    return {
      tagName: element.tagName.slice(0, 64),
      id: element.id.slice(0, 512),
      className: Array.from(element.classList).join(' ').slice(0, 1024),
      textContent: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 500),
      selector: getSelector(element),
      pagePath: `${location.pathname}${location.search}${location.hash}`.slice(0, 2048),
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    }
  }

  const createOverlay = (isSelected: boolean) => {
    const overlay = document.createElement('div')
    overlay.dataset.visualEditorOverlay = channel
    overlay.setAttribute('aria-hidden', 'true')
    overlay.style.cssText = `position:fixed!important;pointer-events:none!important;box-sizing:border-box!important;margin:0!important;padding:0!important;z-index:2147483647!important;display:none;outline-offset:1px;border-radius:3px;${
      isSelected
        ? 'outline:3px solid #1677ff!important;background:rgba(22,119,255,.06)!important;'
        : 'outline:2px dashed #69b1ff!important;background:rgba(105,177,255,.03)!important;'
    }`
    document.documentElement.appendChild(overlay)
    return overlay
  }

  const positionOverlay = (overlay: HTMLDivElement | null, element: Element | null) => {
    if (!overlay) return
    if (!enabled || !element?.isConnected) {
      overlay.style.display = 'none'
      return
    }
    const rect = element.getBoundingClientRect()
    Object.assign(overlay.style, {
      display: 'block',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    })
  }

  const refreshOverlays = () => {
    positionOverlay(hoverOverlay, hovered)
    positionOverlay(selectedOverlay, selected)
  }

  const clearSelection = () => {
    selected = null
    positionOverlay(selectedOverlay, null)
  }

  const getTarget = (event: Event) => {
    const target = event.composedPath().find((item) => item instanceof Element)
    if (!(target instanceof Element)) return null
    if (
      target.closest('[data-visual-editor-overlay]') ||
      ['HTML', 'BODY', 'SCRIPT', 'STYLE', 'LINK', 'META'].includes(target.tagName)
    )
      return null
    return target
  }

  const onHover = (event: Event) => {
    const target = getTarget(event)
    if (target === hovered) return
    hovered = target === selected ? null : target
    positionOverlay(hoverOverlay, hovered)
    if (hovered) emit('ELEMENT_HOVER', hovered)
  }

  const onMouseOut = (event: MouseEvent) => {
    if (!event.relatedTarget) {
      hovered = null
      positionOverlay(hoverOverlay, null)
    }
  }

  const blockInteraction = (event: Event) => {
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.type !== 'click') return
    const target = getTarget(event)
    if (!target) return
    selected = target
    hovered = null
    refreshOverlays()
    emit('ELEMENT_SELECTED', selected)
  }

  const interactionEvents = ['pointerdown', 'mousedown', 'click', 'dblclick', 'auxclick', 'submit']
  const observer = new MutationObserver(() => {
    if (selected && !selected.isConnected) {
      clearSelection()
      emit('SELECTION_CLEARED')
    }
    if (hovered && !hovered.isConnected) hovered = null
    refreshOverlays()
  })

  const disable = () => {
    enabled = false
    interactionEvents.forEach((name) => window.removeEventListener(name, blockInteraction, true))
    window.removeEventListener('mouseover', onHover, true)
    window.removeEventListener('mouseout', onMouseOut, true)
    window.removeEventListener('scroll', refreshOverlays, true)
    window.removeEventListener('resize', refreshOverlays)
    observer.disconnect()
    hovered = null
    selected = null
    hoverOverlay?.remove()
    selectedOverlay?.remove()
    hoverOverlay = null
    selectedOverlay = null
  }

  editorWindow.__aiCodeMotherVisualEditor = {
    channel,
    enable: () => {
      if (enabled) return
      enabled = true
      hoverOverlay = createOverlay(false)
      selectedOverlay = createOverlay(true)
      interactionEvents.forEach((name) =>
        window.addEventListener(name, blockInteraction, { capture: true, passive: false }),
      )
      window.addEventListener('mouseover', onHover, true)
      window.addEventListener('mouseout', onMouseOut, true)
      window.addEventListener('scroll', refreshOverlays, true)
      window.addEventListener('resize', refreshOverlays)
      observer.observe(document.documentElement, { childList: true, subtree: true })
    },
    disable,
    clearSelection,
    destroy: () => {
      disable()
      if (editorWindow.__aiCodeMotherVisualEditor?.channel === channel) {
        delete editorWindow.__aiCodeMotherVisualEditor
      }
    },
  }
}

/** 管理同源 iframe 的编辑模式、消息通信与资源释放。 */
export class VisualEditor {
  private iframe: HTMLIFrameElement | null = null
  private bridge: IframeEditorBridge | null = null
  private isEditMode = false
  private channel = ''
  private origin = ''
  private options: VisualEditorOptions
  private readonly messageListener = (event: MessageEvent) => this.handleIframeMessage(event)
  private readonly loadListener = () => this.onIframeLoad()

  constructor(options: VisualEditorOptions = {}) {
    this.options = options
  }

  init(iframe: HTMLIFrameElement) {
    this.destroy()
    this.iframe = iframe
    this.channel = `visual-editor-${Date.now()}-${++editorSequence}`
    window.addEventListener('message', this.messageListener)
    iframe.addEventListener('load', this.loadListener)
  }

  /** 立即返回是否成功，页面可以据此同步按钮状态。 */
  enableEditMode(): boolean {
    try {
      if (!this.iframe?.contentWindow) throw new Error('网站预览尚未加载完成，请稍后再开启编辑')
      const frameWindow = this.iframe.contentWindow as EditorWindow
      const frameDocument = frameWindow.document
      if (
        !frameDocument.documentElement ||
        frameDocument.readyState === 'loading' ||
        (frameWindow.location.href === 'about:blank' &&
          this.iframe.src &&
          this.iframe.src !== 'about:blank')
      ) {
        throw new Error('网站预览尚未加载完成，请稍后再开启编辑')
      }
      if (frameWindow.location.origin !== window.location.origin)
        throw new Error('可视化编辑需要网站预览与主网站同源')
      this.origin = window.location.origin
      if (frameWindow.__aiCodeMotherVisualEditor?.channel !== this.channel) {
        const script = frameDocument.createElement('script')
        script.textContent = `(${installIframeEditor.toString()})(${JSON.stringify(this.channel)}, ${JSON.stringify(this.origin)});`
        try {
          frameDocument.documentElement.appendChild(script)
        } finally {
          script.remove()
        }
      }
      this.bridge = frameWindow.__aiCodeMotherVisualEditor ?? null
      if (this.bridge?.channel !== this.channel)
        throw new Error('无法初始化可视化编辑，请检查预览页面的脚本安全策略')
      this.bridge.enable()
      this.isEditMode = true
      return true
    } catch (error) {
      this.disableEditMode()
      this.options.onError?.(
        error instanceof Error && error.name !== 'SecurityError'
          ? error
          : new Error('可视化编辑需要网站预览与主网站同源'),
      )
      return false
    }
  }

  disableEditMode() {
    this.isEditMode = false
    try {
      this.bridge?.disable()
    } catch {
      // iframe 导航后旧文档可能已不可访问，清理不能中断页面生命周期。
      this.releaseBridge()
    } finally {
      this.options.onSelectionCleared?.()
    }
  }

  toggleEditMode(): boolean {
    if (this.isEditMode) this.disableEditMode()
    else this.enableEditMode()
    return this.isEditMode
  }

  syncState() {
    if (!this.isEditMode) this.disableEditMode()
  }

  clearSelection() {
    try {
      this.bridge?.clearSelection()
    } catch {
      this.releaseBridge()
    } finally {
      this.options.onSelectionCleared?.()
    }
  }

  /** 导航/刷新后旧 DOM 已失效，先清理选择，再为新文档恢复编辑状态。 */
  onIframeLoad() {
    const shouldEnable = this.isEditMode
    this.isEditMode = false
    this.releaseBridge()
    this.options.onSelectionCleared?.()
    if (shouldEnable) this.enableEditMode()
  }

  handleIframeMessage(event: MessageEvent) {
    if (
      !this.isEditMode ||
      !this.iframe ||
      event.source !== this.iframe.contentWindow ||
      event.origin !== this.origin
    )
      return
    const payload: unknown = event.data
    if (!isRecord(payload) || payload.source !== MESSAGE_SOURCE || payload.channel !== this.channel)
      return
    if (payload.type === 'SELECTION_CLEARED') {
      this.options.onSelectionCleared?.()
      return
    }
    if (!isRecord(payload.data) || !isElementInfo(payload.data.elementInfo)) return
    if (payload.type === 'ELEMENT_SELECTED')
      this.options.onElementSelected?.(payload.data.elementInfo)
    else if (payload.type === 'ELEMENT_HOVER')
      this.options.onElementHover?.(payload.data.elementInfo)
  }

  /** 页面卸载/切换应用时调用，避免遗留事件监听或修改预览行为。 */
  destroy() {
    this.isEditMode = false
    this.releaseBridge()
    this.iframe?.removeEventListener('load', this.loadListener)
    if (typeof window !== 'undefined') window.removeEventListener('message', this.messageListener)
    this.iframe = null
    this.origin = ''
    this.options.onSelectionCleared?.()
  }

  private releaseBridge() {
    const bridge = this.bridge
    this.bridge = null
    try {
      bridge?.destroy()
    } catch {
      // 导航/跨域跳转会使旧 Window 的清理函数失效，引用仍必须释放。
    }
  }
}
