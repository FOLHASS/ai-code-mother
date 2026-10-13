import { API_BASE_URL } from '@/request'

/** AI 正文和工具执行状态分开传递，工具参数及结果不拼接进 AI 正文。 */
export type ChatStreamMessage =
  | { type: 'ai_response'; content: string }
  | {
      type: 'tool_request' | 'tool_executed'
      content?: string
      toolId?: string
      toolName?: string
      toolArguments?: string
    }

/** 原生读取 SSE，独立于自动生成的 API 文件，避免接口生成时被覆盖。 */
export async function* streamChatToGenCode(params: API.chatToGenCodeParams, signal?: AbortSignal) {
  const query = new URLSearchParams({ appId: String(params.appId), message: params.message })
  const response = await fetch(`${API_BASE_URL}/app/chat/gen/code?${query}`, {
    credentials: 'include',
    headers: { Accept: 'text/event-stream, application/json' },
    signal,
  })
  if (!response.ok) throw new Error(`代码生成请求失败（${response.status}）`)

  if (response.headers.get('content-type')?.includes('application/json')) {
    const result = (await response.json()) as API.BaseResponseString
    if (result.code !== 0 || !result.data) throw new Error(result.message || '代码生成失败')
    yield { type: 'ai_response', content: result.data } satisfies ChatStreamMessage
    return
  }
  if (!response.body) throw new Error('代码生成响应为空')

  const parseEvent = (event: string): ChatStreamMessage | { done: true } | null => {
    const lines = event.split(/\r?\n/)
    const type = lines.find((line) => line.startsWith('event:'))?.slice(6).trim()
    const data = lines.filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, '')).join('\n')
    if (type === 'done' || data === '[DONE]') return { done: true }
    let payload: unknown = data
    try { payload = JSON.parse(data) } catch { /* 原始文本片段同样可以显示。 */ }
    if (type === 'error') {
      const detail = payload && typeof payload === 'object' ? (payload as { message?: string }).message : data
      throw new Error(detail || '代码生成失败')
    }
    if (!data) return null
    if (typeof payload === 'string') return { type: 'ai_response', content: payload }
    if (payload && typeof payload === 'object') {
      const detail = payload as {
        type?: string; content?: string; toolId?: string; toolName?: string; toolArguments?: string
        d?: string; code?: number; message?: string
      }
      if (detail.code !== undefined && detail.code !== 0) throw new Error(detail.message || '代码生成失败')
      if (detail.type === 'ai_response') {
        return typeof detail.content === 'string' ? { type: detail.type, content: detail.content } : null
      }
      if (detail.type === 'tool_request' || detail.type === 'tool_executed') {
        return {
          type: detail.type,
          ...(typeof detail.content === 'string' ? { content: detail.content } : {}),
          ...(typeof detail.toolId === 'string' ? { toolId: detail.toolId } : {}),
          ...(typeof detail.toolName === 'string' ? { toolName: detail.toolName } : {}),
          ...(typeof detail.toolArguments === 'string' ? { toolArguments: detail.toolArguments } : {}),
        }
      }
      // 保留旧版文本流兼容，未知结构事件不作为 AI 文本显示。
      if (detail.type) return null
      if (typeof detail.d === 'string') return { type: 'ai_response', content: detail.d }
    }
    return { type: 'ai_response', content: data }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
      let separator = /\r?\n\r?\n/.exec(buffer)
      while (separator) {
        const event = parseEvent(buffer.slice(0, separator.index))
        buffer = buffer.slice(separator.index + separator[0].length)
        if (event && 'done' in event) return
        if (event) yield event
        separator = /\r?\n\r?\n/.exec(buffer)
      }
      if (done) {
        const event = parseEvent(buffer)
        if (event && 'done' in event) return
        if (event) yield event
        throw new Error('生成连接提前结束，请稍后重试')
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
