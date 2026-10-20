/**
 * 在历史记录和实时 SSE 更新之间共用的聊天消息视图模型。
 */
export type ChatMessage = {
  id: string
  historyId?: string
  createTime?: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  loading?: boolean
  error?: boolean
  toolCalls?: {
    id: string
    name: string
    status: 'running' | 'completed' | 'failed'
    arguments?: string
    result?: string
  }[]
}
