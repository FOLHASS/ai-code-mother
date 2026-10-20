/**
 * Normalized stream events consumed by the chat domain.
 *
 * The backend currently uses two different shapes for tool events: request
 * messages use `toolId/toolName/toolArguments`, while completed messages use
 * `id/name/arguments/result`. The transport adapter normalizes both shapes to
 * this type so components never need to know the wire protocol.
 */
export type ChatStreamMessage =  ChatStreamAiResponseMessage | ChatStreamToolRequestMessage
  | ChatStreamThinkingMessage | ChatStreamToolExecutedMessage


/**
 * 该响应于后端一一对应
 */
export type ChatStreamAiResponseMessage = { type: 'ai_response'; content: string }

export type ChatStreamThinkingMessage = { type: 'thinking'; content: string }

export type ChatStreamToolRequestMessage = {
  type: 'tool_request'
  toolId?: string
  toolName?: string
  toolArguments?: string
  content?: string
}

export type ChatStreamToolExecutedMessage = {
  type: 'tool_executed'
  toolId?: string
  toolName?: string
  toolArguments?: string
  result?: string
  /** 兼容旧版流式服务提供的可直接展示结果。 */
  content?: string
}
