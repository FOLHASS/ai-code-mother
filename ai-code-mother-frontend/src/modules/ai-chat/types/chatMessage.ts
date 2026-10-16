/** The view model shared by persisted history and live SSE updates. */
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
