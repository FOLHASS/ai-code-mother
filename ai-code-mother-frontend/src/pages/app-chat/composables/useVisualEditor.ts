import { onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import { message } from 'ant-design-vue'

import { buildVisualEditPrompt, VisualEditor, type ElementInfo } from '@/utils/visualEditor.ts'

/** 页面只持有编辑状态；iframe 的通信、高亮及监听器由工具类统一管理。 */
export function useVisualEditor(previewUrl: Ref<string>) {
  const isEditMode = ref(false)
  const selectedElement = shallowRef<ElementInfo | null>(null)
  let previewIframe: HTMLIFrameElement | null = null

  const editor = new VisualEditor({
    onElementSelected: (element) => {
      if (isEditMode.value) selectedElement.value = element
    },
    onSelectionCleared: () => {
      selectedElement.value = null
    },
    onError: (error) => {
      isEditMode.value = false
      selectedElement.value = null
      message.warning(error.message)
    },
  })

  const clearSelection = () => {
    selectedElement.value = null
    editor.clearSelection()
  }

  const resetVisualEditor = () => {
    isEditMode.value = false
    selectedElement.value = null
    editor.disableEditMode()
  }

  const setPreviewIframe = (iframe: HTMLIFrameElement | null) => {
    if (previewIframe === iframe) return
    resetVisualEditor()
    previewIframe = iframe
    if (iframe) editor.init(iframe)
    else editor.destroy()
  }

  const toggleEditMode = () => {
    if (isEditMode.value) resetVisualEditor()
    else isEditMode.value = editor.enableEditMode()
  }

  // 刷新预览或切换应用时，不让旧页面的选择进入下一条消息。
  watch(previewUrl, resetVisualEditor, { flush: 'sync' })
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
    prepareMessage: (content: string) => buildVisualEditPrompt(content, selectedElement.value),
  }
}
