import { nextTick, ref, type Ref } from 'vue'

import { listAppChatHistoryByPage } from '@/api/chatHistoryController.ts'
import { mergeHistoryMessages, sortHistoryRecords, type ChatMessage } from '@/utils/chatHistory.ts'
import { asApiLongId } from '@/utils/id.ts'

type HistoryContext = {
  app: Ref<API.AppVO | null>
  canReadHistory: Ref<boolean>
  messages: Ref<ChatMessage[]>
  messageList: Ref<HTMLElement | null>
  showPreview: () => Promise<void>
  scrollToBottom: () => Promise<void>
  getVersion: () => number
}

/** 游标分页的状态只在应用会话中存活；合并旧消息时保留滚动锚点。 */
export function useAppHistory({
  app,
  canReadHistory,
  messages,
  messageList,
  showPreview,
  scrollToBottom,
  getVersion,
}: HistoryContext) {
  const isLoadingHistory = ref(false)
  const historyLoaded = ref(false)
  const historyError = ref('')
  const hasMoreHistory = ref(false)
  const historyTotal = ref(0)
  const historyCursor = ref<{ lastCreateTime: string; lastId: string } | null>(null)

  const resetHistory = () => {
    isLoadingHistory.value = false
    historyLoaded.value = false
    historyError.value = ''
    hasMoreHistory.value = false
    historyTotal.value = 0
    historyCursor.value = null
  }

  const loadHistory = async (loadMore = false, version = getVersion()) => {
    if (!app.value?.id || !canReadHistory.value || isLoadingHistory.value) return false
    if (loadMore && (!hasMoreHistory.value || !historyCursor.value)) return false
    isLoadingHistory.value = true
    historyError.value = ''
    try {
      const response = await listAppChatHistoryByPage({
        appId: app.value.id,
        pageSize: 10,
        ...(loadMore && historyCursor.value
          ? {
              lastCreateTime: historyCursor.value.lastCreateTime,
              lastId: asApiLongId(historyCursor.value.lastId),
            }
          : {}),
      })
      if (version !== getVersion()) return false
      if (response.data.code !== 0 || !response.data.data) {
        throw new Error(response.data.message || '对话历史加载失败')
      }
      const page = response.data.data
      const records = sortHistoryRecords(page.records || [])
      const oldest = records[0]
      const remaining = Number(page.totalRow ?? records.length)
      const moreAvailable = records.length > 0 && remaining > records.length
      if (moreAvailable && (!oldest?.id || !oldest.createTime)) {
        throw new Error('历史消息的游标信息不完整，请稍后重试')
      }
      const list = messageList.value
      const previousHeight = list?.scrollHeight || 0
      const previousTop = list?.scrollTop || 0
      const anchor = list?.querySelector<HTMLElement>('.message-row')
      const anchorTop = anchor?.getBoundingClientRect().top
      messages.value = mergeHistoryMessages(loadMore ? messages.value : [], records)
      historyCursor.value =
        oldest?.id && oldest.createTime
          ? { lastId: String(oldest.id), lastCreateTime: oldest.createTime }
          : null
      hasMoreHistory.value = moreAvailable
      if (!loadMore) {
        historyLoaded.value = true
        historyTotal.value = remaining
        if (remaining >= 2 || records.length >= 2) await showPreview()
        await scrollToBottom()
      } else {
        // 在顶部插入旧消息后补偿高度，保持用户正在阅读的位置。
        await nextTick()
        if (version === getVersion() && list) {
          list.scrollTop = Math.max(
            0,
            previousTop +
              (anchor?.isConnected && anchorTop !== undefined
                ? anchor.getBoundingClientRect().top - anchorTop
                : list.scrollHeight - previousHeight),
          )
        }
      }
      return true
    } catch (error) {
      if (version === getVersion()) {
        historyError.value = error instanceof Error ? error.message : '对话历史加载失败，请稍后重试'
      }
      return false
    } finally {
      if (version === getVersion()) isLoadingHistory.value = false
    }
  }

  return {
    isLoadingHistory,
    historyLoaded,
    historyError,
    hasMoreHistory,
    historyTotal,
    resetHistory,
    loadHistory,
  }
}
