/**
 * 聊天展示层的数据模型与历史记录转换工具，无 Vue 状态和网络依赖。
 * 服务端持久化 ID 与实时消息临时 ID 分开保存，分页合并按历史 ID 去重，避免混淆两个命名空间。
 */
import type { ChatMessage } from '../types/chatMessage.ts'

/** 创建时间相同的历史按完整整数 ID 升序排序，默认值用于缺失 ID 的兼容排序。 */
const compareIds = (left: string | number = '0', right: string | number = '0') => {
  // 雪花 ID 超出 Number 的安全范围，直接比较整数，保留同秒消息的顺序。
  const a = BigInt(left)
  const b = BigInt(right)
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * 克隆后排序，不修改接口返回的原数组。时间主排序、ID 次排序使同秒记录的展示顺序确定。
 * 返回升序时间线，调用方可用首项继续向更早记录翻页。
 */
export const sortHistoryRecords = (records: API.ChatHistoryVO[]) => [...records].sort((a, b) =>
  (a.createTime || '').localeCompare(b.createTime || '') || compareIds(a.id || '0', b.id || '0'),
)

/**
 * 将更早的一页转换成聊天模型并前置到现有列表，不删除当前实时消息。
 * 同时去掉与 current 重复以及同一页内部重复的持久化记录；无 ID 记录不进入时间线。
 */
export const mergeHistoryMessages = (current: ChatMessage[], records: API.ChatHistoryVO[]) => {
  // Set 仅收集历史 ID；实时 live-* 消息没有 historyId，因此不会误匹配数据库记录。
  const existingIds = new Set(current.map((item) => item.historyId).filter(Boolean))
  const olderMessages: ChatMessage[] = []
  for (const record of sortHistoryRecords(records)) {
    if (!record.id) continue
    const id = String(record.id)
    if (existingIds.has(id)) continue
    // 当场加入集合，确保接口单页若出现相同记录，也只追加一次。
    existingIds.add(id)
    olderMessages.push({
      id: `history-${id}`,
      historyId: id,
      createTime: record.createTime,
      role: record.messageType === 'user' ? 'user' : 'assistant',
      content: record.message || '',
      // 后端当前用失败标记持久化错误，只有 AI 记录匹配标记才恢复失败气泡语义。
      error: record.messageType === 'ai' && Boolean(record.message?.includes('[生成失败]')),
    })
  }
  // 输入 records 会先按时间升序排列，追加位置固定在已加载内容之前。
  return [...olderMessages, ...current]
}
