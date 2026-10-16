/**
 * 面向聊天时间线的历史加载模块：服务端每次返回最近十条，前端升序排列后向列表前端合并。
 * 游标由最旧消息的创建时间和 ID 共同组成，避免同一时间记录翻页时重复或遗漏。
 * 权限、当前会话版本和并发加载状态在请求入口及响应提交前分别校验。
 */
import { nextTick, ref, type Ref } from 'vue'

import { listAppChatHistory } from '../api/chatHistoryApi.ts'
import { mergeHistoryMessages, sortHistoryRecords } from '../services/chatHistoryMapper.ts'
import type { ChatMessage } from '../types/chatMessage.ts'

/**
 * 外部提供共享消息列表和应用引用；本模块拥有分页状态，不拥有整个页面的生命周期。
 * getVersion 用于丢弃旧应用响应；messageList 与 scrollToBottom 分别支持向前加载和首屏定位。
 */
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
  // historyLoaded 专门表示首屏读取成功；加载失败时保持 false，禁止错误地自动发送初始化消息。
  const isLoadingHistory = ref(false)
  const historyLoaded = ref(false)
  const historyError = ref('')
  const hasMoreHistory = ref(false)
  // 首次成功请求保存总条数，供初始化和“至少两条记录可尝试预览”的规则使用。
  const historyTotal = ref(0)
  // 组合游标始终指向已加载记录中最旧的一条，ID 以字符串保存完整精度。
  const historyCursor = ref<{ lastCreateTime: string; lastId: string } | null>(null)
  let historyController: AbortController | null = null

  /** 切换应用时重置所有分页元数据；共享消息数组由上层编排模块同时清空。 */
  const resetHistory = () => {
    historyController?.abort()
    historyController = null
    isLoadingHistory.value = false
    historyLoaded.value = false
    historyError.value = ''
    hasMoreHistory.value = false
    historyTotal.value = 0
    historyCursor.value = null
  }

  /**
   * loadMore=false 获取最新一页并替换历史时间线；true 携带游标向更早时间继续查询。
   * 返回 true 代表本次有效响应已处理，false 包括权限不足、重复请求、失效响应和失败。
   */
  const loadHistory = async (loadMore = false, version = getVersion()) => {
    // 并发保护覆盖首屏、重试和“加载更多”，防止同一游标重复发起请求。
    if (!app.value?.id || !canReadHistory.value || isLoadingHistory.value) return false
    if (loadMore && (!hasMoreHistory.value || !historyCursor.value)) return false
    isLoadingHistory.value = true
    historyError.value = ''
    const controller = new AbortController()
    historyController = controller
    try {
      // 初次查询不传游标；追加查询同时传递时间和 ID，接口页大小固定为聊天约定的十条。
      const response = await listAppChatHistory({
        appId: String(app.value.id),
        pageSize: 10,
        ...(loadMore && historyCursor.value
          ? {
              lastCreateTime: historyCursor.value.lastCreateTime,
              lastId: historyCursor.value.lastId,
            }
          : {}),
      }, { signal: controller.signal })
      if (version !== getVersion()) return false
      if (response.data.code !== 0 || !response.data.data) {
        throw new Error(response.data.message || '对话历史加载失败')
      }
      const page = response.data.data
      // 服务端用于分页的倒序结果转为视觉上的升序，最旧记录位于数组首端。
      const records = sortHistoryRecords(page.records || [])
      const oldest = records[0]
      // 当前接口 totalRow 反映本次游标之前的可用数量，用它判断当前页后是否还有更旧记录。
      const remaining = Number(page.totalRow ?? records.length)
      const moreAvailable = records.length > 0 && remaining > records.length
      // 后续分页必须具有完整组合游标；缺失时提示错误，避免按钮重复加载相同页面。
      if (moreAvailable && (!oldest?.id || !oldest.createTime)) {
        throw new Error('历史消息的游标信息不完整，请稍后重试')
      }
      // 合并前记录首条可见历史行的实际位置；优先以该 DOM 锚点补偿，必要时回退到高度差。
      const list = messageList.value
      const previousHeight = list?.scrollHeight || 0
      const previousTop = list?.scrollTop || 0
      const anchor = list?.querySelector<HTMLElement>('.message-row')
      const anchorTop = anchor?.getBoundingClientRect().top
      // mergeHistoryMessages 按持久化 ID 去重并前置旧消息，保留已显示的实时会话消息。
      messages.value = mergeHistoryMessages(loadMore ? messages.value : [], records)
      historyCursor.value =
        oldest?.id && oldest.createTime
          ? { lastId: String(oldest.id), lastCreateTime: oldest.createTime }
          : null
      hasMoreHistory.value = moreAvailable
      // 首屏成功后标记可对话，并按历史条数尝试检查预览；静态文件存在才真正显示 iframe。
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
    // 失败只更新当前应用的错误提示，已有消息保留，以便用户重试并继续阅读。
    } catch (error) {
      if (version === getVersion()) {
        historyError.value = error instanceof Error ? error.message : '对话历史加载失败，请稍后重试'
      }
      return false
    // 旧应用请求不得复位新应用正在进行的加载标志。
    } finally {
      if (historyController === controller) historyController = null
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
