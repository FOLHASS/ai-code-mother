/**
 * 把命令式的 iframe 编辑器封装为 Vue 响应式接口，页面不接触事件监听或覆盖层 DOM。
 * selectedElement 使用 shallowRef：选中信息是一次性的只读快照，不需要追踪内部 rect 的嵌套字段。
 * 预览刷新、应用切换和组件卸载都会撤销编辑器状态与资源。
 */
import { onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import { message } from 'ant-design-vue'

import { buildVisualEditPrompt, VisualEditor, type ElementInfo } from '@/utils/visualEditor.ts'

/** 页面只持有编辑状态；iframe 的通信、高亮及监听器由工具类统一管理。 */
export function useVisualEditor(previewUrl: Ref<string>) {
  const isEditMode = ref(false)
  const selectedElement = shallowRef<ElementInfo | null>(null)
  // iframe DOM 是非响应式资源句柄，只有绑定变化才重新初始化，避免重复注册窗口监听。
  let previewIframe: HTMLIFrameElement | null = null

  // 工具类回调只桥接状态与用户提示；权限条件统一由上层 useAppChat 控制。
  const editor = new VisualEditor({
    // 关闭模式后可能仍有排队的消息，因此写入选中状态时再检查一次编辑标志。
    onElementSelected: (element) => {
      if (isEditMode.value) selectedElement.value = element
    },
    onSelectionCleared: () => {
      selectedElement.value = null
    },
    // 同源限制、预览未就绪或注入失败时回收 UI 状态，不让按钮显示为虚假的编辑中。
    onError: (error) => {
      isEditMode.value = false
      selectedElement.value = null
      message.warning(error.message)
    },
  })

  /** 仅移除当前定位目标，保留编辑模式，用户可继续在预览中选择其他元素。 */
  const clearSelection = () => {
    selectedElement.value = null
    editor.clearSelection()
  }

  /** 完整退出编辑：清空响应式选择，再关闭 iframe 的交互拦截和高亮覆盖层。 */
  const resetVisualEditor = () => {
    isEditMode.value = false
    selectedElement.value = null
    editor.disableEditMode()
  }

  /** 预览面板通过 ready/null 通知 DOM 生命周期；旧 iframe 必须先复原，再绑定新实例。 */
  const setPreviewIframe = (iframe: HTMLIFrameElement | null) => {
    if (previewIframe === iframe) return
    resetVisualEditor()
    previewIframe = iframe
    if (iframe) editor.init(iframe)
    else editor.destroy()
  }

  /** 启用结果来自工具类的同步返回值，只有桥接安装成功才在 UI 标为编辑状态。 */
  const toggleEditMode = () => {
    if (isEditMode.value) resetVisualEditor()
    else isEditMode.value = editor.enableEditMode()
  }

  // 刷新预览或切换应用时，不让旧页面的选择进入下一条消息。
  watch(previewUrl, resetVisualEditor, { flush: 'sync' })
  // Vue 组合式函数随所属页面卸载，主动释放 window/iframe 监听和旧 DOM 引用。
  onUnmounted(() => {
    editor.destroy()
    previewIframe = null
  })

  return {
    isEditMode,
    selectedElement,
    setPreviewIframe,
    toggleEditMode,
    clearSelection,
    resetVisualEditor,
    // 调用时才读取当前选择；发送流程先构造提示词，再 reset，定位快照不会被提前清空。
    prepareMessage: (content: string) => buildVisualEditPrompt(content, selectedElement.value),
  }
}

export type VisualEditorContext = Parameters<typeof useVisualEditor>[0]
export type VisualEditorComposable = ReturnType<typeof useVisualEditor>
