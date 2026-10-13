export type ChatMessage = {
  id: string
  historyId?: string
  createTime?: string
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
  error?: boolean
  toolCalls?: {
    id: string
    name: string
    status: 'running' | 'completed' | 'failed'
  }[]
}

const compareIds = (left: string | number = '0', right: string | number = '0') => {
  // 雪花 ID 超出 Number 的安全范围，直接比较整数，保留同秒消息的顺序。
  const a = BigInt(left)
  const b = BigInt(right)
  return a < b ? -1 : a > b ? 1 : 0
}

export const sortHistoryRecords = (records: API.ChatHistoryVO[]) => [...records].sort((a, b) =>
  (a.createTime || '').localeCompare(b.createTime || '') || compareIds(a.id || '0', b.id || '0'),
)

export const mergeHistoryMessages = (current: ChatMessage[], records: API.ChatHistoryVO[]) => {
  const existingIds = new Set(current.map((item) => item.historyId).filter(Boolean))
  const olderMessages: ChatMessage[] = []
  for (const record of sortHistoryRecords(records)) {
    if (!record.id) continue
    const id = String(record.id)
    if (existingIds.has(id)) continue
    existingIds.add(id)
    olderMessages.push({
      id: `history-${id}`,
      historyId: id,
      createTime: record.createTime,
      role: record.messageType === 'user' ? 'user' : 'assistant',
      content: record.message || '',
      error: record.messageType === 'ai' && Boolean(record.message?.includes('[生成失败]')),
    })
  }
  return [...olderMessages, ...current]
}
