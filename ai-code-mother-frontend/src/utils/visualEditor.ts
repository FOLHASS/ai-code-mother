/**
 * 可视化编辑的底层实现，分为父页面控制器、注入 iframe 的选择器和提示词构造三个边界。
 * 父页面只持有选择结果；高亮在 iframe 内绘制，不修改网站源文件、class 或原有布局。
 * 只有用户发消息时才把定位信息附加到提示词，最终文件修改仍通过后端生成流程完成。
 */
import { CodeGenTypeEnum } from './codeGenTypes.ts'

/** 用户在预览网站中选中的元素，供对话提示词定位修改目标。 */
export interface ElementInfo {
  /** DOM 标签、原始标识、class 和截断后的文本，帮助模型把预览元素映射到源码。 */
  tagName: string
  id: string
  className: string
  textContent: string
  selector: string
  /** iframe 当前的页面路径与查询/hash；发送前会清理仅用于预览的 Vue 构建目录。 */
  pagePath: string
  /** 视口坐标供高亮定位使用，不会被附加到要求修改源码的提示词中。 */
  rect: { top: number; left: number; width: number; height: number }
}

export interface VisualEditorOptions {
  /** 点击选择后通知父页面，用于输入框上方的元素提示。 */
  onElementSelected?: (elementInfo: ElementInfo) => void
  onElementHover?: (elementInfo: ElementInfo) => void
  /** 页面导航、选择失效或主动关闭时清理上层展示，避免旧元素被继续提交。 */
  onSelectionCleared?: () => void
  onError?: (error: Error) => void
}

interface IframeEditorBridge {
  /** 当前实例的通信通道，用于区分 iframe 中过期的选择事件。 */
  channel: string
  enable: () => void
  disable: () => void
  clearSelection: () => void
  destroy: () => void
}

type EditorWindow = Window & { __aiCodeMotherVisualEditor?: IframeEditorBridge }

// 消息命名空间固定，实例通道另行生成；窗口来源、同源地址、通道三者都需要匹配。
const MESSAGE_SOURCE = 'ai-code-mother-visual-editor'
let editorSequence = 0

/** 先验证消息是普通对象，再读取内部字段；数组和 null 都不能作为消息对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 校验 iframe 发来的数据，避免其他窗口消息或异常数据影响聊天状态。 */
function isElementInfo(value: unknown): value is ElementInfo {
  if (!isRecord(value) || !isRecord(value.rect)) return false
  const limits = {
    // 限制跨窗口数据规模；这里只验证协议格式，不意味着对应选择器一定能唯一定位源码。
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
  // 坐标允许负数（元素可能部分滚出视口），尺寸必须非负，所有值都必须是有限数。
  return ['top', 'left', 'width', 'height'].every((key) => {
    const field = rect[key]
    return (
      typeof field === 'number' &&
      Number.isFinite(field) &&
      (!['width', 'height'].includes(key) || field >= 0)
    )
  })
}

/** 流式接口使用 GET 查询参数，按编码后的长度而不是中文字符数衡量上下文开销。 */
function encodedLength(value: string): number {
  return encodeURIComponent(value).length
}

/** 按实际 URL 编码长度控制上下文大小，不切断 Unicode 字符。 */
function shortenContextText(value: string, budget: number): string {
  if (encodedLength(JSON.stringify(value)) <= budget) return value
  const characters = Array.from(value)
  // 按 Unicode 码点截取，用二分查找找到满足预算的最长前缀，避免切断代理对。
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
  // 普通对话原样返回，只有存在选择结果时才附加结构化编辑上下文。
  // 判断非空
  if (!element) return message
  const { pagePath: previewPagePath, selector, tagName, id, className, textContent } = element
  // dist 仅属于 Vue 预览的构建产物目录，后端修改目标使用去掉该层目录的页面路径。
  // 只处理应用目录紧随的 dist，保留文件名、查询参数、hash 路由及其他真实目录。
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
  // selector 已包含的信息不用再次发送。
  if (id && !selector.includes(id)) context.id = id
  if (className && !className.split(/\s+/).every((name) => selector.includes(`.${name}`)))
    context.className = className
  const serialize = () =>
    `\n\n【可视化编辑目标】\n${JSON.stringify(context)}\n结合页面路径、选择器与元素文本修改选中元素。`
  if (encodedLength(serialize()) > 3500) {
    // 先去掉冗余属性，再压缩文本/路径；定位信息被精简时明确告知模型，避免伪造精确定位。
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
      // 极端长路径再次降级为标签和文本定位，用户原始修改要求本身不会被截断。
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
  // toString() 后运行在另一个文档，所有运行时依赖都必须在函数内部或浏览器全局可获取。
  const editorWindow = window as EditorWindow
  editorWindow.__aiCodeMotherVisualEditor?.destroy()
  let enabled = false
  let hovered: Element | null = null
  let selected: Element | null = null
  let hoverOverlay: HTMLDivElement | null = null
  let selectedOverlay: HTMLDivElement | null = null

  const emit = (type: string, element?: Element) => {
    // 不使用通配目标域；父页面仍会再次验证 source/origin/channel 和数据字段。
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
    // 没有可用唯一 ID 时逐层增加 nth-child 祖先链，只返回完整的 CSS 片段。
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
    // 在事件发生时读取坐标与文字快照，父页面不需要跨窗口保留真实 DOM 元素引用。
    const rect = element.getBoundingClientRect()
    console.log({
      tagName: element.tagName.slice(0, 64),
      id: element.id.slice(0, 512),
      className: Array.from(element.classList).join(' ').slice(0, 1024),
      textContent: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 500),
      selector: getSelector(element),
      pagePath: `${location.pathname}${location.search}${location.hash}`.slice(0, 2048),
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    })
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
    // 固定定位覆盖层使用视口坐标且不接收鼠标事件，悬浮为浅色虚线，选中为深色实线。
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
    // DOM 已移除或模式已关闭时隐藏边框；滚动/缩放后重新读取矩形而不使用过期坐标。
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
    // 两个覆盖层独立刷新，因此悬浮其他元素不会清除已经固定的选中边框。
    positionOverlay(hoverOverlay, hovered)
    positionOverlay(selectedOverlay, selected)
  }

  const clearSelection = () => {
    // 仅取消选择，不关闭编辑模式，用户可以继续选中其他元素。
    selected = null
    positionOverlay(selectedOverlay, null)
  }

  const getTarget = (event: Event) => {
    // composedPath 兼容 SVG 等元素目标，同时排除覆盖层自身和不适合作为可视元素的节点。
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
    // 同一悬浮目标不重复通知，已选中的元素继续使用固定选中边框。
    const target = getTarget(event)
    if (target === hovered) return
    hovered = target === selected ? null : target
    positionOverlay(hoverOverlay, hovered)
    if (hovered) emit('ELEMENT_HOVER', hovered)
  }

  const onMouseOut = (event: MouseEvent) => {
    // 鼠标真正离开文档后清理悬浮层；选中层继续保留。
    if (!event.relatedTarget) {
      hovered = null
      positionOverlay(hoverOverlay, null)
    }
  }

  const blockInteraction = (event: Event) => {
    // 进入选择模式后拦截网站的点击/提交，防止点链接导航或点按钮产生业务操作。
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
  // 网站自身可能动态重绘 DOM；选中节点被移除时通知父页面清理提示，而不是保留失效选择。
  const observer = new MutationObserver(() => {
    if (selected && !selected.isConnected) {
      clearSelection()
      emit('SELECTION_CLEARED')
    }
    if (hovered && !hovered.isConnected) hovered = null
    refreshOverlays()
  })

  const disable = () => {
    // 先停止模式和监听器，再移除覆盖层，使网站立即恢复原有交互并避免观察器响应清理动作。
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
      // 重复开启保持幂等，避免叠加监听器和重复绘制边框。
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
      // 只有仍属于当前实例的桥接对象才被删除，避免旧实例清理掉后来建立的新通道。
      disable()
      if (editorWindow.__aiCodeMotherVisualEditor?.channel === channel) {
        delete editorWindow.__aiCodeMotherVisualEditor
      }
    },
  }
}

/** 管理同源 iframe 的编辑模式、消息通信与资源释放。 */
export class VisualEditor {
  // DOM 引用和桥接状态属于当前页面实例，不进入 Pinia，也不跨应用复用。
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

  /** 绑定新预览前先销毁旧绑定；回调引用固定，移除监听时与注册时保持一致。 */
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
        // 只在当前文档尚未建立本实例桥接时注入；脚本执行后立即移除脚本节点。
        const script = frameDocument.createElement('script')
        script.textContent = `(${installIframeEditor.toString()})(${JSON.stringify(this.channel)}, ${JSON.stringify(this.origin)});`
        try {
          frameDocument.documentElement.appendChild(script)
        } finally {
          script.remove()
        }
      }
      this.bridge = frameWindow.__aiCodeMotherVisualEditor ?? null
      // 注入可能被预览页面 CSP 拒绝，检查桥接是否建立后才把 UI 标记为编辑中。
      if (this.bridge?.channel !== this.channel)
        throw new Error('无法初始化可视化编辑，请检查预览页面的脚本安全策略')
      this.bridge.enable()
      this.isEditMode = true
      return true
    } catch (error) {
      // 开启失败先清理局部状态，再向页面交付可读错误；不保留半开启的模式。
      this.disableEditMode()
      this.options.onError?.(
        error instanceof Error && error.name !== 'SecurityError'
          ? error
          : new Error('可视化编辑需要网站预览与主网站同源'),
      )
      return false
    }
  }

  /** 关闭模式但保留 iframe 绑定，下一次开启可以复用当前文档中的桥接。 */
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

  /** 返回切换后的实际状态，开启失败时仍为 false。 */
  toggleEditMode(): boolean {
    if (this.isEditMode) this.disableEditMode()
    else this.enableEditMode()
    return this.isEditMode
  }

  /** 外部需要同步时，仅在非编辑模式补做幂等清理。 */
  syncState() {
    if (!this.isEditMode) this.disableEditMode()
  }

  /** 同时取消 iframe 内的选中边框和父页面提示，不影响用户继续选择。 */
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
    // 旧文档的 DOM 与函数引用均可能失效；清理后按原先是否编辑决定要不要重新注入。
    const shouldEnable = this.isEditMode
    this.isEditMode = false
    this.releaseBridge()
    this.options.onSelectionCleared?.()
    if (shouldEnable) this.enableEditMode()
  }

  /** 只有当前编辑中的预览 iframe 能更新选择状态；其他来源或过期消息直接忽略。 */
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
    // 先断开本实例引用，确保旧窗口的销毁函数抛错时仍不会留下悬挂状态。
    const bridge = this.bridge
    this.bridge = null
    try {
      bridge?.destroy()
    } catch {
      // 导航/跨域跳转会使旧 Window 的清理函数失效，引用仍必须释放。
    }
  }
}
