import type { ChatHistoryRecord } from '@/shared/domain/models.ts'
import type { ChatMessage } from '../types/chatMessage.ts'

/** 把持久化聊天记录转换并整理为时间线数据。 */
export class ChatHistoryMapperService {
  /** 比较两个聊天记录 ID 的顺序。 */
  private compareIds(left: string | number = '0', right: string | number = '0') {
    const a = BigInt(left)
    const b = BigInt(right)
    return a < b ? -1 : a > b ? 1 : 0
  }

  /** 按创建时间及 ID 对聊天历史排序。 */
  sort(records: ChatHistoryRecord[]) {
    return [...records].sort(
      (a, b) =>
        (a.createTime || '').localeCompare(b.createTime || '') ||
        this.compareIds(a.id || '0', b.id || '0'),
    )
  }

  /** 合并多页聊天记录并去除重复项。 */
  merge(current: ChatMessage[], records: ChatHistoryRecord[]) {
    const existingIds = new Set(current.map((item) => item.historyId).filter(Boolean))
    const olderMessages: ChatMessage[] = []
    for (const record of this.sort(records)) {
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
}
