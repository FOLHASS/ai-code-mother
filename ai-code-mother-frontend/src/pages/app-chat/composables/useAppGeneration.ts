import { ref, type Ref } from 'vue'
import { message } from 'ant-design-vue'

import type { ChatMessage } from '@/utils/chatHistory.ts'
import { streamChatToGenCode, type ChatStreamMessage } from '@/utils/chatStream.ts'
import { asApiLongId } from '@/utils/id.ts'

type GenerationContext = {
  app: Ref<API.AppVO | null>
  canInteract: Ref<boolean>
  historyLoaded: Ref<boolean>
  isLoadingHistory: Ref<boolean>
  messages: Ref<ChatMessage[]>
  messageList: Ref<HTMLElement | null>
  showPreview: (cacheBust?: boolean) => Promise<void>
  scrollToBottom: () => Promise<void>
  getVersion: () => number
  prepareMessage?: (content: string) => string
  onMessageSent?: () => void
}

/** 一次生成对应一条用户消息和一条可流式更新的 AI 消息。 */
export function useAppGeneration({
  app,
  canInteract,
  historyLoaded,
  isLoadingHistory,
  messages,
  messageList,
  showPreview,
  scrollToBottom,
  getVersion,
  prepareMessage,
  onMessageSent,
}: GenerationContext) {
  const input = ref('')
  const isStreaming = ref(false)
  let messageId = 0
  let generationController: AbortController | null = null

  const resetGeneration = () => {
    generationController?.abort()
    generationController = null
    input.value = ''
    isStreaming.value = false
  }

  const appendStreamMessage = (assistantMessage: ChatMessage, chunk: ChatStreamMessage) => {
    const list = messageList.value
    const shouldScroll = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 80
    if (chunk.type === 'ai_response') {
      assistantMessage.content += chunk.content
    } else if (chunk.type === 'thinking') {
      assistantMessage.thinking = (assistantMessage.thinking || '') + chunk.content
    } else {
      const tools = (assistantMessage.toolCalls ??= [])
      // 同一次工具调用通过 ID 更新状态；没有 ID 时匹配最近一次同名调用。
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
      if (chunk.type === 'tool_executed') {
        // 完成回调代表执行结束，仍需区分工具返回的 success=false。
        let failed = false
        try {
          const result: unknown = JSON.parse(chunk.content || '')
          failed = Boolean(
            result && typeof result === 'object' && 'success' in result && result.success === false,
          )
        } catch {
          // 普通文本工具结果也可表示一次完整的调用。
        }
        tool.status = failed ? 'failed' : 'completed'
      }
    }
    const index = messages.value.findIndex((item) => item.id === assistantMessage.id)
    if (index >= 0) {
      messages.value[index] = { ...assistantMessage }
    }
    if (shouldScroll && !isLoadingHistory.value) void scrollToBottom()
  }

  const sendMessage = async (value = input.value, isInitial = false) => {
    const content = value.trim()
    if (
      !content ||
      isStreaming.value ||
      !app.value?.id ||
      !canInteract.value ||
      !historyLoaded.value
    )
      return
    const version = getVersion()
    const currentAppId = app.value.id
    const prompt = !isInitial && prepareMessage ? prepareMessage(content) : content
    const controller = new AbortController()
    generationController = controller
    if (!isInitial) input.value = ''

    messages.value.push({
      id: `live-${++messageId}`,
      role: 'user',
      content,
      createTime: new Date().toISOString(),
    })
    const assistantMessage: ChatMessage = {
      id: `live-${++messageId}`,
      role: 'assistant',
      content: '',
      loading: true,
    }
    messages.value.push(assistantMessage)
    isStreaming.value = true
    onMessageSent?.()
    await scrollToBottom()

    try {
      for await (const chunk of streamChatToGenCode(
        { appId: asApiLongId(String(currentAppId)), message: prompt },
        controller.signal,
      )) {
        if (version !== getVersion()) return
        appendStreamMessage(assistantMessage, chunk)
      }
      if (version !== getVersion()) return
      assistantMessage.loading = false
      assistantMessage.createTime = new Date().toISOString()
      await showPreview(true)
    } catch (error) {
      if (version !== getVersion() || controller.signal.aborted) return
      assistantMessage.loading = false
      assistantMessage.error = true
      assistantMessage.toolCalls?.forEach((tool) => {
        if (tool.status === 'running') tool.status = 'failed'
      })
      const reason = error instanceof Error ? error.message : '生成失败，请稍后重试'
      assistantMessage.content = `${assistantMessage.content ? assistantMessage.content + '\n\n' : ''}[生成失败] ${reason}`
      message.error(reason)
    } finally {
      if (version === getVersion()) {
        assistantMessage.loading = false
        const index = messages.value.findIndex((item) => item.id === assistantMessage.id)
        if (index >= 0) messages.value[index] = { ...assistantMessage }
        isStreaming.value = false
        generationController = null
      }
    }
  }

  return { input, isStreaming, resetGeneration, sendMessage }
}
