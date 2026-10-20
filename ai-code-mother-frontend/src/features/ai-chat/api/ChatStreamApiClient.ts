import { createAbortScope } from '@/shared/async/AbortScope.ts'
import { API_BASE_URL, MAX_ENCODED_PROMPT_LENGTH, STREAM_IDLE_TIMEOUT } from '@/config/env.ts'
import { ApiError, isAuthenticationError } from '@/shared/api/errors.ts'
import { authEvents } from '@/shared/api/authEvents.ts'
import type { ChatStreamMessage } from '../types/chatEvent.ts'
import { ChatProtocolAdapterService } from '../services/ChatProtocolAdapterService.ts'

export type ChatStreamParams = { appId: string; message: string }
export type ChatStreamPort = {
  // signal 用于实现中断流式请求，避免浪费服务器资源
  stream: (params: ChatStreamParams, signal?: AbortSignal) => AsyncGenerator<ChatStreamMessage>
}

/** 封装聊天生成请求，并将服务端事件流交给调用方处理。 */
export class ChatStreamApiClient implements ChatStreamPort {
  /** 接收聊天流接口客户端运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供可替换的网络请求实现。 */
    private readonly fetcher: typeof fetch = fetch,
    /** 配置聊天流连续无数据时允许等待的时长。 */
    private readonly idleTimeout = STREAM_IDLE_TIMEOUT,
    /** 解析聊天流数据并转换为统一事件的适配器。 */
    private readonly protocol = new ChatProtocolAdapterService(),
  ) {}
  /** 发送聊天生成请求并逐条读取服务端事件。 */
  async *stream(params: ChatStreamParams, signal?: AbortSignal): AsyncGenerator<ChatStreamMessage> {
    const query = new URLSearchParams(params)
    if (query.toString().length > MAX_ENCODED_PROMPT_LENGTH)
      throw new ApiError('消息过长，请拆分描述后发送')
    const request = createAbortScope(
      signal,
      this.idleTimeout,
      new ApiError('生成连接长时间无响应，请重试'),
    )
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      const fetcher = this.fetcher
      const response = await fetcher(`${API_BASE_URL}/app/chat/gen/code?${query}`, {
        credentials: 'include',
        headers: { Accept: 'text/event-stream, application/json' },
        signal: request.signal,
      })
      if (!response.ok) {
        throw new ApiError(`代码生成请求失败（${response.status}）`, undefined, response.status)
      }
      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = (await response.json()) as { code?: number; data?: string; message?: string }
        if (result.code !== 0 || !result.data)
          throw new ApiError(result.message || '代码生成失败', result.code)
        yield { type: 'ai_response', content: result.data }
        return
      }
      if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body)
        throw new ApiError('代码生成响应格式不正确')
      reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        request.refreshDeadline()
        buffer += decoder.decode(value, { stream: !done })
        if (buffer.length > 2_000_000) throw new ApiError('单条流事件过大，请重试')
        let separator = /\r?\n\r?\n/.exec(buffer)
        while (separator) {
          const event = this.protocol.parse(buffer.slice(0, separator.index))
          buffer = buffer.slice(separator.index + separator[0].length)
          if (event && 'done' in event) return
          if (event) yield event
          separator = /\r?\n\r?\n/.exec(buffer)
        }
        if (done) {
          const event = this.protocol.parse(buffer)
          if (event && 'done' in event) return
          if (event) yield event
          throw new ApiError('生成连接提前结束，请稍后重试')
        }
      }
    } catch (error) {
      if (isAuthenticationError(error)) authEvents.expired()
      if (request.signal.aborted && !signal?.aborted) throw request.reason
      throw error
    } finally {
      request.dispose()
      if (reader) {
        await reader.cancel().catch(() => undefined)
        reader.releaseLock()
      }
    }
  }
}
