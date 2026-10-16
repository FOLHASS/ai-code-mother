/**
 * 负责一次用户输入到 SSE 完成的生成生命周期：创建消息占位、增量更新、错误提示和完成后预览。
 * 用户消息只保存输入原文；prepareMessage 可以额外给后端附加可视化编辑目标。
 * AbortController 负责终止网络读取，会话版本负责阻止旧任务把结果写回已切换的应用。
 */
import { ref, type Ref } from 'vue'
import { message } from 'ant-design-vue'

import { streamChatToGenCode } from '../api/chatStreamApi.ts'
import type { ChatStreamMessage } from '../types/chatEvent.ts'
import type { ChatMessage } from '../types/chatMessage.ts'
import { asApiLongId } from '@/utils/id.ts'

/**
 * 输入为当前会话共享的应用、权限和消息引用；回调由编排层提供以隔离预览与编辑器实现。
 * prepareMessage 仅处理非初始化发送，onMessageSent 在请求已创建时清理可视化选择和编辑状态。
 */
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
  // 输入草稿和生成中的互斥标志属于当前会话；messageId 仅用于区分本地尚未持久化的消息。
  const input = ref('')
  const isStreaming = ref(false)
  let messageId = 0
  // 同时只允许一个生成请求；切换应用或卸载时通过该控制器释放流式读取。
  let generationController: AbortController | null = null

  /** 先中断旧流，再清空输入和忙碌状态；不删除共享消息，消息重置由页面编排统一负责。 */
  const resetGeneration = () => {
    generationController?.abort()
    generationController = null
    input.value = ''
    isStreaming.value = false
  }

  /** 把结构化 SSE 片段归并到同一条 AI 消息，正文、思考和工具状态分别更新。 */
  const appendStreamMessage = (assistantMessage: ChatMessage, chunk: ChatStreamMessage) => {
    const list = messageList.value
    // 仅用户接近底部时自动跟随，手动向上阅读历史时不强制把视口拉回最新消息。
    const shouldScroll = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 80
    // 文本直接追加；思考保持独立字段，工具调用只生成状态条，不污染可见 AI 正文。
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
      // 完成事件可能先于可见的请求事件到达，找不到调用时创建条目，随后立即更新为终态。
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
        // 完成回调代表执行结束，仍需区分工具返回的 success=false。
        let failed = false
        try {
          // 工具协议以 success=false 表示业务失败；非 JSON 结果仍视作正常完成回调。
          const result: unknown = JSON.parse(chunk.result || chunk.content || '')
          failed = Boolean(
            result && typeof result === 'object' && 'success' in result && result.success === false,
          )
        } catch {
          // 普通文本工具结果也可表示一次完整的调用。
        }
        tool.status = failed ? 'failed' : 'completed'
      }
    }
    // 每次替换一层消息对象，确保基于消息数组渲染的组件能观察到累积字段和工具列表变化。
    const index = messages.value.findIndex((item) => item.id === assistantMessage.id)
    if (index >= 0) {
      messages.value[index] = { ...assistantMessage }
    }
    if (shouldScroll && !isLoadingHistory.value) void scrollToBottom()
  }

  /**
   * 默认发送当前草稿，初始化调用则显式传 initPrompt 并保留输入框处理语义。
   * 空文本、生成中、无应用、非创建者或历史未就绪均直接返回；真实权限仍由后端校验。
   */
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
    // 快照锁定请求所属应用；后续路由变化不会把用户原请求发送给另一个应用。
    const version = getVersion()
    const currentAppId = app.value.id
    // 增强提示词只用于接口；用户气泡仍展示 content，避免把冗长定位 JSON 当作用户输入显示。
    const prompt = !isInitial && prepareMessage ? prepareMessage(content) : content
    const controller = new AbortController()
    generationController = controller
    if (!isInitial) input.value = ''

    // 乐观追加用户消息和空 AI 消息，让界面立即显示已发送与生成中的反馈。
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
    // 已快照提示词后退出编辑并清理选择，避免下一次输入沿用旧元素。
    onMessageSent?.()
    await scrollToBottom()

    try {
      // 异步迭代器持续读取所有类型的消息，接口参数中的 Long 通过字符串适配避免精度损失。
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
      // 收到服务端正常完成标记后再检查构建产物，附带防缓存参数读取刚生成的版本。
      await showPreview(true)
    // 用户离开导致的 abort 不作为生成失败；有效失败保留已生成正文并给未结束工具补上失败状态。
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
    // 成功、失败均结束本次消息的 loading；版本校验防止清理逻辑误伤新的会话。
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
