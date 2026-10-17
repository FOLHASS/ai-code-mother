import { ApiError } from '@/shared/api/errors.ts'
import type { ChatStreamMessage } from '../types/chatEvent.ts'

type StreamPayload = Record<string, unknown>

/** 规范化服务端聊天事件并解析完整的 SSE 数据帧。 */
export class ChatProtocolAdapterService {
  /** 从事件数据中提取可展示的文本内容。 */
  private asText(value: unknown): string | undefined {
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

  /** 规范化服务端事件负载结构。 */
  private asPayload(value: unknown): StreamPayload | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as StreamPayload)
      : null
  }

  /** 解析 JSON 文本并确保结果为对象。 */
  private parseJsonObject(value: string): StreamPayload | null {
    try {
      return this.asPayload(JSON.parse(value))
    } catch {
      return null
    }
  }

  /** 将单个服务端事件转换为统一聊天事件。 */
  adapt(payload: unknown): ChatStreamMessage | null {
    if (typeof payload === 'string') {
      const nested = this.parseJsonObject(payload)
      return nested ? this.adapt(nested) : { type: 'ai_response', content: payload }
    }
    const detail = this.asPayload(payload)
    if (!detail) return null
    const wrapped = detail.d
    if (typeof wrapped === 'string') {
      const nested = this.parseJsonObject(wrapped)
      return nested ? this.adapt(nested) : { type: 'ai_response', content: wrapped }
    }
    if (wrapped !== undefined) return this.adapt(wrapped)

    const type = this.asText(detail.type)
    if (type === 'ai_response') {
      const content = this.asText(detail.data ?? detail.content)
      return content === undefined ? null : { type: 'ai_response', content }
    }
    if (type === 'thinking') {
      const content = this.asText(detail.content ?? detail.data)
      return content === undefined ? null : { type: 'thinking', content }
    }
    if (type === 'tool_request') {
      const toolId = this.asText(detail.toolId ?? detail.id)
      const toolName = this.asText(detail.toolName ?? detail.name)
      const toolArguments = this.asText(detail.toolArguments ?? detail.arguments)
      const content = this.asText(detail.content)
      return {
        type: 'tool_request',
        ...(toolId === undefined ? {} : { toolId }),
        ...(toolName === undefined ? {} : { toolName }),
        ...(toolArguments === undefined ? {} : { toolArguments }),
        ...(content === undefined ? {} : { content }),
      }
    }
    if (type === 'tool_executed') {
      const toolId = this.asText(detail.id ?? detail.toolId)
      const toolName = this.asText(detail.name ?? detail.toolName)
      const toolArguments = this.asText(detail.arguments ?? detail.toolArguments)
      const result = this.asText(detail.result ?? detail.content)
      return {
        type: 'tool_executed',
        ...(toolId === undefined ? {} : { toolId }),
        ...(toolName === undefined ? {} : { toolName }),
        ...(toolArguments === undefined ? {} : { toolArguments }),
        ...(result === undefined ? {} : { result, content: result }),
      }
    }
    const content = this.asText(detail.data)
    return content === undefined ? null : { type: 'ai_response', content }
  }

  /** 解析服务端发送的事件文本。 */
  parse(event: string): ChatStreamMessage | { done: true } | null {
    const lines = event.split(/\r?\n/)
    const type = lines
      .find((line) => line.startsWith('event:'))
      ?.slice(6)
      .trim()
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
      const detail = this.asPayload(payload)
      throw new ApiError(
        this.asText(detail?.message) || data || '代码生成失败',
        typeof detail?.code === 'number' ? detail.code : undefined,
      )
    }
    const response = this.asPayload(payload)
    if (response?.code !== undefined && response.code !== 0) {
      throw new Error(this.asText(response.message) || '代码生成失败')
    }
    return this.adapt(payload)
  }
}

export type ParsedChatSseEvent = ChatStreamMessage | { done: true } | null
