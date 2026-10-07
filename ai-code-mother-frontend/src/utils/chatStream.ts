import { API_BASE_URL } from '@/request'

/** 原生读取 SSE，独立于自动生成的 API 文件，避免接口生成时被覆盖。 */
export async function* streamChatToGenCode(params: API.chatToGenCodeParams, signal?: AbortSignal) {
  const query = new URLSearchParams({ appId: params.appId, message: params.message })
  const response = await fetch(`${API_BASE_URL}/app/chat/gen/code?${query}`, {
    credentials: 'include',
    headers: { Accept: 'text/event-stream, application/json' },
    signal,
  })
  if (!response.ok) throw new Error(`代码生成请求失败（${response.status}）`)

  if (response.headers.get('content-type')?.includes('application/json')) {
    const result = (await response.json()) as API.BaseResponseString
    if (result.code !== 0 || !result.data) throw new Error(result.message || '代码生成失败')
    yield result.data
    return
  }
  if (!response.body) throw new Error('代码生成响应为空')

  const parseEvent = (event: string) => {
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
    if (typeof payload === 'string') return { content: payload }
    if (payload && typeof payload === 'object') {
      const detail = payload as { d?: string; code?: number; message?: string }
      if (detail.code !== undefined && detail.code !== 0) throw new Error(detail.message || '代码生成失败')
      if (typeof detail.d === 'string') return { content: detail.d }
    }
    return { content: data }
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
        if (event?.done) return
        if (event?.content) yield event.content
        separator = /\r?\n\r?\n/.exec(buffer)
      }
      if (done) {
        const event = parseEvent(buffer)
        if (event?.done) return
        if (event?.content) yield event.content
        throw new Error('生成连接提前结束，请稍后重试')
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
