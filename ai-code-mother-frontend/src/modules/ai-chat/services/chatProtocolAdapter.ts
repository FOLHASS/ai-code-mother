import type { ChatStreamMessage } from '../types/chatEvent.ts'

type StreamPayload = Record<string, unknown>

const asText = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return undefined
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return undefined
  }
}

const asPayload = (value: unknown): StreamPayload | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as StreamPayload) : null

const parseJsonObject = (value: string): StreamPayload | null => {
  try {
    return asPayload(JSON.parse(value))
  } catch {
    return null
  }
}

/**
 * 将后端流事件适配为聊天领域事件。后端历史上同时使用 d、data、content
 * 以及 id/name/arguments/result 字段，因此所有兼容逻辑集中在此处。
 */
export const adaptChatStreamPayload = (payload: unknown): ChatStreamMessage | null => {
  if (typeof payload === 'string') {
    const nested = parseJsonObject(payload)
    return nested ? adaptChatStreamPayload(nested) : { type: 'ai_response', content: payload }
  }

  const detail = asPayload(payload)
  if (!detail) return null

  const wrapped = detail.d
  if (typeof wrapped === 'string') {
    const nested = parseJsonObject(wrapped)
    return nested ? adaptChatStreamPayload(nested) : { type: 'ai_response', content: wrapped }
  }
  if (wrapped !== undefined) return adaptChatStreamPayload(wrapped)

  const type = asText(detail.type)
  if (type === 'ai_response') {
    const content = asText(detail.data ?? detail.content)
    return content === undefined ? null : { type: 'ai_response', content }
  }
  if (type === 'thinking') {
    const content = asText(detail.content ?? detail.data)
    return content === undefined ? null : { type: 'thinking', content }
  }
  if (type === 'tool_request') {
    const toolId = asText(detail.toolId ?? detail.id)
    const toolName = asText(detail.toolName ?? detail.name)
    const toolArguments = asText(detail.toolArguments ?? detail.arguments)
    const content = asText(detail.content)
    return {
      type: 'tool_request',
      ...(toolId === undefined ? {} : { toolId }),
      ...(toolName === undefined ? {} : { toolName }),
      ...(toolArguments === undefined ? {} : { toolArguments }),
      ...(content === undefined ? {} : { content }),
    }
  }
  if (type === 'tool_executed') {
    const toolId = asText(detail.id ?? detail.toolId)
    const toolName = asText(detail.name ?? detail.toolName)
    const toolArguments = asText(detail.arguments ?? detail.toolArguments)
    const result = asText(detail.result ?? detail.content)
    return {
      type: 'tool_executed',
      ...(toolId === undefined ? {} : { toolId }),
      ...(toolName === undefined ? {} : { toolName }),
      ...(toolArguments === undefined ? {} : { toolArguments }),
      ...(result === undefined ? {} : { result, content: result }),
    }
  }

  // 未知结构没有可展示文本时安全丢弃；纯 data 字段兼容旧版正文事件。
  const content = asText(detail.data)
  return content === undefined ? null : { type: 'ai_response', content }
}

export type ParsedChatSseEvent = ChatStreamMessage | { done: true } | null

/** Parse one complete SSE frame after the byte stream has found its blank-line separator. */
export const parseChatSseEvent = (event: string): ParsedChatSseEvent => {
  const lines = event.split(/\r?\n/)
  const type = lines.find((line) => line.startsWith('event:'))?.slice(6).trim()
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
    .join('\n')

  if (type === 'done' || data === '[DONE]') return { done: true }
  if (!data) return null

  let payload: unknown = data
  try {
    payload = JSON.parse(data)
  } catch {
    // Plain text data is a valid legacy response.
  }
  if (type === 'error') {
    const detail = asPayload(payload)
    throw new Error(asText(detail?.message) || data || '代码生成失败')
  }
  const response = asPayload(payload)
  if (response?.code !== undefined && response.code !== 0) {
    throw new Error(asText(response.message) || '代码生成失败')
  }
  return adaptChatStreamPayload(payload)
}

