/**
 * 代码生成接口的流式协议适配层：处理普通 JSON 返回、原始文本 SSE 与结构化工具/思考事件。
 * 使用异步生成器逐条产出消息，不在本文件维护 UI 状态；AbortSignal 由会话生命周期统一提供。
 * 网络分包不等于 SSE 事件边界，必须累积字节、解码并按空行分帧后再解析。
 */
import { API_BASE_URL } from '@/config/env.ts'
import type { ChatStreamMessage } from '../types/chatEvent.ts'
import { parseChatSseEvent } from '../services/chatProtocolAdapter.ts'

export { adaptChatStreamPayload, parseChatSseEvent } from '../services/chatProtocolAdapter.ts'
export type { ChatStreamMessage } from '../types/chatEvent.ts'

/** 原生读取 SSE，独立于自动生成的 API 文件，避免接口生成时被覆盖。 */
/**
 * 以当前 GET 协议携带应用 ID 和提示词，URLSearchParams 负责参数编码；Cookie 用于后端会话权限校验。
 * 消费端 for-await 接收增量事件，正常结束依赖后端 done / [DONE] 标记，裸连接关闭按异常处理。
 * 退出、抛错和取消最终均执行 reader 清理，防止遗留网络读取或锁。
 */
export async function* streamChatToGenCode(params: API.chatToGenCodeParams, signal?: AbortSignal) {
  // appId 保持已有字符串形式；不会在此通过 Number 转换大整数。
  const query = new URLSearchParams({ appId: String(params.appId), message: params.message })
  const response = await fetch(`${API_BASE_URL}/app/chat/gen/code?${query}`, {
    credentials: 'include',
    headers: { Accept: 'text/event-stream, application/json' },
    signal,
  })
  if (!response.ok) throw new Error(`代码生成请求失败（${response.status}）`)

  // 兼容接口直接返回完整 JSON 的路径，同时让统一业务错误能够在开始读流前直接上抛。
  if (response.headers.get('content-type')?.includes('application/json')) {
    const result = (await response.json()) as API.BaseResponseString
    if (result.code !== 0 || !result.data) throw new Error(result.message || '代码生成失败')
    yield { type: 'ai_response', content: result.data } satisfies ChatStreamMessage
    return
  }
  if (!response.body) throw new Error('代码生成响应为空')

  // 使用原始字节流读取器控制消费与取消；同一个 TextDecoder 跨网络分包保留 UTF-8 解码状态。
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  // buffer 只保存尚未找到完整空行分隔符的尾部内容，允许一帧跨多次 read 返回。
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      // stream=true 防止分包截断中文或 emoji；结束时 stream=false 刷出解码器剩余字节。
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
      // 一次网络读取可能带多帧，循环切分直到缓冲区只剩未完成的帧尾。
      let separator = /\r?\n\r?\n/.exec(buffer)
      while (separator) {
        const event = parseChatSseEvent(buffer.slice(0, separator.index))
        buffer = buffer.slice(separator.index + separator[0].length)
        if (event && 'done' in event) return
        if (event) yield event
        separator = /\r?\n\r?\n/.exec(buffer)
      }
      // EOF 时仍处理末尾未带空行的数据；只有显式完成事件才成功，防止半截回复被误认成生成完成。
      if (done) {
        const event = parseChatSseEvent(buffer)
        if (event && 'done' in event) return
        if (event) yield event
        throw new Error('生成连接提前结束，请稍后重试')
      }
    }
  // 正常 done、消费者提前停止、解析失败和 AbortSignal 取消都走此清理路径。
  } finally {
    // cancel 自身因已关闭连接失败时忽略其错误，保留最早的业务/网络异常并继续释放 reader 锁。
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
