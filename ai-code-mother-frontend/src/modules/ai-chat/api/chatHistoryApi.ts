/**
 * Chat history transport facade.
 *
 * Generated API declarations currently describe Java Long values as numbers.
 * The module API accepts strings at its boundary and applies the existing
 * string-preserving cast only when calling generated functions.
 */
import {
  adminListChatHistoryByPage,
  listAppChatHistoryByPage,
} from '@/api/chatHistoryController.ts'
import { asApiLongId } from '@/utils/id.ts'

export type AppChatHistoryQuery = {
  appId: string
  pageSize?: number
  lastCreateTime?: string
  lastId?: string
}

export type ChatHistoryRequestOptions = { signal?: AbortSignal }

export const listAppChatHistory = (query: AppChatHistoryQuery, options?: ChatHistoryRequestOptions) =>
  listAppChatHistoryByPage({
    appId: asApiLongId(query.appId),
    pageSize: query.pageSize,
    lastCreateTime: query.lastCreateTime,
    ...(query.lastId ? { lastId: asApiLongId(query.lastId) } : {}),
  }, options)

export type AdminChatHistoryQuery = {
  pageNum?: number
  pageSize?: number
  sortField?: string
  sortOrder?: string
  id?: string
  appId?: string
  userId?: string
  messageType?: string
  message?: string
}

export const listAdminChatHistory = (query: AdminChatHistoryQuery, options?: ChatHistoryRequestOptions) =>
  adminListChatHistoryByPage({
    pageNum: query.pageNum,
    pageSize: query.pageSize,
    sortField: query.sortField,
    sortOrder: query.sortOrder,
    ...(query.id ? { id: asApiLongId(query.id) } : {}),
    ...(query.appId ? { appId: asApiLongId(query.appId) } : {}),
    ...(query.userId ? { userId: asApiLongId(query.userId) } : {}),
    messageType: query.messageType,
    message: query.message,
  }, options)
