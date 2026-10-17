import { readonly, ref, type Ref } from 'vue'
import type { AppSummary, ChatHistoryRecord } from '@/shared/domain/models.ts'
import type { ChatHistoryRepository } from '../api/ChatHistoryApiClient.ts'
import { ChatHistoryMapperService } from './ChatHistoryMapperService.ts'
import { LatestRequest } from '@/shared/async/LatestRequest.ts'
import { errorMessage } from '@/shared/api/errors.ts'

export type ChatHistoryContext = {
  app: Readonly<Ref<AppSummary | null>>
  canReadHistory: Readonly<Ref<boolean>>
  getVersion: () => number
}
export type HistoryPage = { records: ChatHistoryRecord[]; total: number }

/** 管理聊天历史分页加载及其加载状态。 */
export class ChatHistoryService {
  /** 记录历史记录是否正在加载。 */
  private readonly loading = ref(false)
  /** 标记首批历史记录是否已加载完成。 */
  private readonly loaded = ref(false)
  /** 保存最近一次加载失败的错误信息。 */
  private readonly error = ref('')
  /** 标记是否还有下一页历史记录可加载。 */
  private readonly more = ref(false)
  /** 只读暴露当前查询结果总数。 */
  private readonly total = ref(0)
  /** 记录历史记录请求是否正在执行。 */
  readonly isLoadingHistory = readonly(this.loading)
  /** 标记当前会话历史是否已完成初始化。 */
  readonly historyLoaded = readonly(this.loaded)
  /** 保存当前会话历史加载错误。 */
  readonly historyError = readonly(this.error)
  /** 标记当前会话是否还有更早的历史消息。 */
  readonly hasMoreHistory = readonly(this.more)
  /** 只读暴露聊天历史总记录数。 */
  readonly historyTotal = readonly(this.total)
  /** 保存分页加载使用的时间和 ID 游标。 */
  private cursor: { lastCreateTime: string; lastId: string } | null = null
  /** 提供带过期保护的异步请求控制。 */
  private readonly request = new LatestRequest()
  /** 提供接口数据与前端模型之间的映射能力。 */
  private readonly mapper = new ChatHistoryMapperService()

  /** 接收聊天历史服务运行所需的依赖并初始化状态。 */
  constructor(
    /** 提供当前业务流程使用的共享状态和回调。 */
    private readonly context: ChatHistoryContext,
    /** 提供控制器所需的后端接口操作。 */
    private readonly api: Pick<ChatHistoryRepository, 'listApp'>,
  ) {}
  /** 清空历史记录、游标和加载状态。 */
  reset = (): void => {
    this.request.cancel()
    this.loading.value = false
    this.loaded.value = false
    this.error.value = ''
    this.more.value = false
    this.total.value = 0
    this.cursor = null
  }
  /** 按游标加载聊天历史，并合并到现有记录中。 */
  load = async (
    loadMore = false,
    version = this.context.getVersion(),
  ): Promise<HistoryPage | null> => {
    const { app, canReadHistory, getVersion } = this.context
    if (
      !app.value ||
      !canReadHistory.value ||
      this.loading.value ||
      (loadMore && (!this.more.value || !this.cursor))
    )
      return null
    const request = this.request.begin()
    this.loading.value = true
    this.error.value = ''
    try {
      const response = await this.api.listApp(
        { appId: app.value.id, pageSize: 10, ...(loadMore && this.cursor ? this.cursor : {}) },
        { signal: request.signal },
      )
      if (version !== getVersion() || !request.isCurrent()) return null
      const records = this.mapper.sort(response.data.data.records)
      const oldest = records[0]
      const total = response.data.data.totalRow
      const hasMore = records.length > 0 && total > records.length
      if (hasMore && (!oldest?.id || !oldest.createTime))
        throw new Error('历史消息的游标信息不完整，请稍后重试')
      this.cursor =
        oldest?.id && oldest.createTime
          ? { lastId: oldest.id, lastCreateTime: oldest.createTime }
          : null
      this.more.value = hasMore
      if (!loadMore) {
        this.loaded.value = true
        this.total.value = total
      }
      return { records, total }
    } catch (error) {
      if (version === getVersion() && request.isCurrent())
        this.error.value = errorMessage(error, '对话历史加载失败，请稍后重试')
      return null
    } finally {
      if (version === getVersion() && request.isCurrent()) this.loading.value = false
    }
  }
}
