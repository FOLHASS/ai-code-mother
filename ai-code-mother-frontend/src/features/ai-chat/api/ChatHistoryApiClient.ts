import {
  adminListChatHistoryByPage,
  listAppChatHistoryByPage,
} from '@/api/chatHistoryController.ts'
import { adaptResponse, toWire, type RequestOptions } from '@/shared/api/adapter.ts'
import { mapHistory, mapPage } from '@/shared/api/mappers.ts'
import type { PageQuery } from '@/shared/domain/models.ts'

export type AppChatHistoryQuery = {
  appId: string
  pageSize?: number
  lastCreateTime?: string
  lastId?: string
}
export type AdminChatHistoryQuery = PageQuery & {
  id?: string
  appId?: string
  userId?: string
  messageType?: string
  message?: string
}

/** 封装面向普通用户和管理员的聊天历史查询接口。 */
export class ChatHistoryApiClient {
  /**
   * 查询指定应用的聊天历史记录
   * @param query
   * @param options
   */
  listApp = (query: AppChatHistoryQuery, options?: RequestOptions) =>
    adaptResponse(
      listAppChatHistoryByPage(toWire<API.ChatHistoryAppQueryRequest>(query), options),
      (page) => mapPage(page, mapHistory),
    )
  /**
   * 按筛选条件分页查询管理端聊天历史
   * @param query
   * @param options
   */
  listAdmin = (query: AdminChatHistoryQuery, options?: RequestOptions) =>
    adaptResponse(
      adminListChatHistoryByPage(toWire<API.ChatHistoryQueryRequest>(query), options),
      (page) => mapPage(page, mapHistory),
    )
}
export type ChatHistoryRepository = Pick<ChatHistoryApiClient, keyof ChatHistoryApiClient>
