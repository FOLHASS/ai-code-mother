import { readonly, ref, shallowRef } from 'vue'
import type { ElementInfo } from '@/shared/domain/element.ts'
import type { Notifier } from '@/shared/ports.ts'
import { VisualEditPromptBuilder } from './VisualEditPromptBuilder.ts'
import { VisualEditor, type VisualEditorOptions } from './VisualEditor.ts'

/** 协调可视化编辑器的选择状态、消息生成和清理。 */
export class VisualEditorController {
  /** 记录预览页面是否处于元素编辑状态。 */
  private readonly editing = ref(false)
  /** 标记预览编辑器通信是否已经就绪。 */
  private readonly ready = ref(false)
  /** 保存当前预览元素选择结果。 */
  private readonly selection = shallowRef<ElementInfo | null>(null)
  /** 记录预览页面是否处于可视化编辑模式。 */
  readonly isEditMode = readonly(this.editing)
  /** 标记预览编辑器通信是否已经就绪。 */
  readonly isReady = readonly(this.ready)
  /** 保存当前在预览页面中选中的元素信息。 */
  readonly selectedElement = readonly(this.selection)
  /** 保存预览页面的 iframe 元素引用。 */
  private iframe: HTMLIFrameElement | null = null
  /** 负责把选中元素信息转换为编辑提示词。 */
  private readonly promptBuilder = new VisualEditPromptBuilder()
  /** 提供可视化编辑器通信能力。 */
  private readonly editor: VisualEditor

  /** 接收可视化编辑控制器运行所需的依赖并初始化状态。 */
  constructor(
    notify: Notifier,
    createEditor: (options: VisualEditorOptions) => VisualEditor = (options) =>
      new VisualEditor(options),
  ) {
    this.editor = createEditor({
      onElementSelected: (element) => {
        if (this.editing.value) this.selection.value = element
      },
      onSelectionCleared: () => {
        this.selection.value = null
      },
      onReady: (ready) => {
        this.ready.value = ready
        if (!ready) {
          this.editing.value = false
          this.selection.value = null
        }
      },
      onError: (error) => {
        this.editing.value = false
        this.selection.value = null
        notify.warning(error.message)
      },
    })
  }
  /** 清除当前选中元素及其编辑提示信息。 */
  clearSelection = (): void => {
    this.selection.value = null
    this.editor.clearSelection()
  }
  /** 退出编辑模式并清除当前选中元素。 */
  reset = (): void => {
    this.editing.value = false
    this.selection.value = null
    this.editor.disableEditMode()
  }
  /** 设置预览 iframe 并初始化 iframe 消息桥。 */
  setPreviewIframe = (iframe: HTMLIFrameElement | null): void => {
    if (iframe === this.iframe) return
    this.reset()
    this.iframe = iframe
    if (iframe) this.editor.init(iframe)
    else this.editor.destroy()
  }
  /** 切换预览页面的可视化编辑模式。 */
  toggleEditMode = (): void => {
    if (this.editing.value) this.reset()
    else this.editing.value = this.editor.enableEditMode()
  }
  /** 把选中元素信息转换为可发送的编辑请求。 */
  prepareMessage = (content: string): string =>
    this.promptBuilder.build(content, this.selection.value)
  /** 移除监听器并释放关联资源。 */
  destroy = (): void => {
    this.reset()
    this.editor.destroy()
    this.iframe = null
  }
}
