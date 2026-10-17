import type { ElementInfo } from '@/shared/domain/element.ts'
type IframeEditorBridge = {
  channel: string
  enable: () => void
  disable: () => void
  clearSelection: () => void
  destroy: () => void
}
type EditorWindow = Window & { __aiCodeMotherVisualEditor?: IframeEditorBridge }

/** 在预览页面安装可视化编辑消息处理器。 */
function installIframeEditor(channel: string, parentOrigin: string) {
  // 在隔离预览文档中运行，仅访问当前 iframe 的 DOM。
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

// Served as a standalone classic script by the isolated static-only gateway.
const origins =
  (document.currentScript as HTMLScriptElement | null)?.dataset.appOrigins?.split(',') || []
const source = 'ai-code-mother-visual-editor'
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window.parent || !origins.includes(event.origin)) return
  const value: unknown = event.data
  if (
    !value ||
    typeof value !== 'object' ||
    !('source' in value) ||
    value.source !== source ||
    !('channel' in value) ||
    typeof value.channel !== 'string' ||
    value.channel.length > 128 ||
    !('type' in value)
  )
    return
  const frame = window as EditorWindow
  if (value.type === 'INIT') {
    installIframeEditor(value.channel, event.origin)
    window.parent.postMessage({ source, channel: value.channel, type: 'READY' }, event.origin)
    return
  }
  const bridge = frame.__aiCodeMotherVisualEditor
  if (bridge?.channel !== value.channel) return
  if (value.type === 'ENABLE') bridge.enable()
  else if (value.type === 'DISABLE') bridge.disable()
  else if (value.type === 'CLEAR') bridge.clearSelection()
})
window.addEventListener('pagehide', () =>
  (window as EditorWindow).__aiCodeMotherVisualEditor?.destroy(),
)
