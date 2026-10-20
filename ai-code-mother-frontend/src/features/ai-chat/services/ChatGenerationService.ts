import { readonly, ref, type Ref } from 'vue'
import type { AppInfo } from '@/shared/domain/models.ts'
import type { ChatStreamMessage } from '../types/chatEvent.ts'
import type { ChatMessage } from '../types/chatMessage.ts'
import type { ChatTimelinePort } from './ChatTimeline.ts'
import type { ChatStreamPort } from '../api/ChatStreamApiClient.ts'
import { errorMessage } from '@/shared/api/errors.ts'

export type ChatGenerationContext = {
  app: Readonly<Ref<AppInfo | null>>
  canInteract: Readonly<Ref<boolean>>
  historyLoaded: Readonly<Ref<boolean>>
  getVersion: () => number
  prepareMessage?: (content: string) => string
  onMessageSent?: () => void
  onUpdated?: () => void
  onCompleted?: () => void
  onError?: (error: unknown) => void
}
/** 管理一次聊天生成的输入、流式响应和中止状态。 */
export class ChatGenerationService {
  /** 保存用户当前输入的提示词。 */
  readonly input = ref('')
  /** 记录聊天流是否仍在接收数据。 */
  private readonly streaming = ref(false)
  /** 只读暴露当前是否正在生成回复。 */
  readonly isStreaming = readonly(this.streaming)
  /** 保存当前助手回复对应的消息 ID。 */
  private messageId = 0
  /** 持有当前生成请求的中止控制器。 */
  private controller: AbortController | null = null

  /** 接收聊天生成服务运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供当前业务流程使用的共享状态和回调。 */
    private readonly generationContext: ChatGenerationContext,
    /** 提供聊天流请求能力。 */
    private readonly streamApi: ChatStreamPort,
    /** 管理聊天消息时间线及消息合并。 */
    private readonly timeline: ChatTimelinePort,
  ) {}
  /** 中止当前聊天生成并清空输入和生成状态。 */
  reset = (): void => {
    this.controller?.abort()
    this.controller = null
    this.input.value = ''
    this.streaming.value = false
  }

  /** 把新收到的文本片段追加到当前助手消息。 */
  private appendChunk(message: ChatMessage, chunk: ChatStreamMessage): void {
    if (chunk.type === 'ai_response') {
      message.content += chunk.content
      return
    }
    if (chunk.type === 'thinking') {
      message.thinking = (message.thinking || '') + chunk.content
      return
    }
    const tools = (message.toolCalls ??= [])
    let tool = chunk.toolId
      ? tools.find((item) => item.id === chunk.toolId)
      : chunk.type === 'tool_executed'
        ? [...tools]
            .reverse()
            .find((item) => item.name === (chunk.toolName || '工具') && item.status === 'running')
        : undefined
    if (!tool) {
      tool = {
        id: chunk.toolId || `tool-${tools.length}`,
        name: chunk.toolName || '工具',
        status: 'running',
      }
      tools.push(tool)
    }
    if (chunk.toolArguments !== undefined) tool.arguments = chunk.toolArguments
    if (chunk.type === 'tool_executed') {
      tool.result = chunk.result || chunk.content
      let failed = false
      try {
        const result: unknown = JSON.parse(tool.result || '')
        failed = Boolean(
          result && typeof result === 'object' && 'success' in result && result.success === false,
        )
      } catch {
        /* Plain text is a completed tool result. */
      }
      tool.status = failed ? 'failed' : 'completed'
    }
  }

  /** 发送用户消息并消费服务端的流式生成事件。 */
  send = async (value = this.input.value, isInitial = false): Promise<void> => {
    const { app, canInteract, historyLoaded, getVersion } = this.generationContext
    const content = value.trim()
    if (
      !content ||
      this.streaming.value ||
      !app.value ||
      !canInteract.value ||
      !historyLoaded.value
    )
      return
    const version = getVersion()
    const controller = new AbortController()
    this.controller = controller
    const current = () =>
      version === getVersion() && this.controller === controller && !controller.signal.aborted

    // 如果不是第一次发送提示词，需要考虑是否采用了编辑元素 需要添加提示词
    const prompt =
      !isInitial && this.generationContext.prepareMessage ? this.generationContext.prepareMessage(content) : content
    if (!isInitial) this.input.value = ''
    const assistant: ChatMessage = {
      id: `live-${++this.messageId}`,
      role: 'assistant',
      content: '',
      loading: true,
    }
    this.timeline.append(
      {
        id: `live-${++this.messageId}`,
        role: 'user',
        content,
        createTime: new Date().toISOString(),
      },
      assistant,
    )
    this.streaming.value = true
    this.generationContext.onMessageSent?.()
    this.generationContext.onUpdated?.()
    let timer: ReturnType<typeof setTimeout> | undefined
    const flush = () => {
      timer = undefined
      if (current()) {
        this.timeline.update(assistant)
        this.generationContext.onUpdated?.()
      }
    }
    let completed = false
    try {
      for await (const chunk of this.streamApi.stream(
        { appId: app.value.id, message: prompt },
        controller.signal,
      )) {
        if (!current()) return
        this.appendChunk(assistant, chunk)
        if (!timer) timer = setTimeout(flush, 25)
      }
      if (!current()) return
      assistant.createTime = new Date().toISOString()
      completed = true
    } catch (error) {
      if (!current()) return
      assistant.error = true
      assistant.toolCalls?.forEach((tool) => {
        if (tool.status === 'running') tool.status = 'failed'
      })
      assistant.content += `${assistant.content ? '\n\n' : ''}[生成失败] ${errorMessage(error, '生成失败，请稍后重试')}`
      this.generationContext.onError?.(error)
    } finally {
      if (timer) clearTimeout(timer)
      if (current()) {
        assistant.loading = false
        flush()
        this.streaming.value = false
        this.controller = null
        if (completed) this.generationContext.onCompleted?.()
      }
    }
  }
}
