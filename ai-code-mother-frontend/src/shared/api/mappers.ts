import type {
  AppInfo,
  ChatHistoryRecord,
  PageResult,
  UserInfo,
} from '@/shared/domain/models.ts'
import { ApiError } from './errors.ts'
import { entityId, optionalId } from './adapter.ts'

/** 仅把领域模型需要的字段映射到应用状态，隔离接口额外字段。 */
export function mapUser(value: API.UserVO | API.LoginUserVO): UserInfo {
  return {
    id: optionalId(value.id),
    userAccount: value.userAccount,
    userName: value.userName,
    userAvatar: value.userAvatar,
    userProfile: value.userProfile,
    userRole: value.userRole,
    createTime: value.createTime,
    updateTime: 'updateTime' in value ? value.updateTime : undefined,
  }
}

/** 把应用接口数据转换为前端领域模型。 */
export function mapApp(value: API.AppVO): AppInfo {
  return {
    id: entityId(value.id),
    userId: optionalId(value.userId),
    appName: value.appName,
    cover: value.cover,
    initPrompt: value.initPrompt,
    codeGenType: value.codeGenType,
    deployKey: value.deployKey,
    deployedTime: value.deployedTime,
    priority: value.priority,
    editTime: value.editTime,
    createTime: value.createTime,
    updateTime: value.updateTime,
    user: value.user ? mapUser(value.user) : undefined,
  }
}

/** 把聊天历史接口数据转换为前端领域模型。 */
export function mapHistory(value: API.ChatHistoryVO): ChatHistoryRecord {
  return {
    id: optionalId(value.id),
    appId: optionalId(value.appId),
    userId: optionalId(value.userId),
    message: value.message,
    messageType: value.messageType,
    createTime: value.createTime,
    updateTime: value.updateTime,
  }
}

type PageNumber = number | string | null

/** 将输入值规范化为安全的页码数字。 */
function pageNumber(value: PageNumber | undefined, field: string): number {
  if (value == null) return 0
  if (typeof value === 'string' && !/^\d+$/.test(value.trim()))
    throw new ApiError(`服务端返回的分页字段 ${field} 无效`)
  const number = typeof value === 'string' ? Number(value.trim()) : value
  if (!Number.isSafeInteger(number) || number < 0)
    throw new ApiError(`服务端返回的分页字段 ${field} 超出有效范围`)
  return number
}

/** 把分页接口结果映射为统一分页结构。 */
export function mapPage<T, U>(
  value: {
    records?: T[]
    totalRow?: PageNumber
    pageNumber?: PageNumber
    pageSize?: PageNumber
    totalPage?: PageNumber
  },
  map: (record: T) => U,
): PageResult<U> {
  return {
    records: (value.records || []).map(map),
    totalRow: pageNumber(value.totalRow, 'totalRow'),
    pageNumber: value.pageNumber == null ? undefined : pageNumber(value.pageNumber, 'pageNumber'),
    pageSize: value.pageSize == null ? undefined : pageNumber(value.pageSize, 'pageSize'),
    totalPage: value.totalPage == null ? undefined : pageNumber(value.totalPage, 'totalPage'),
  }
}

/** 把登录用户接口数据转换为会话用户模型。 */
export function mapSessionUser(value: API.LoginUserVO): UserInfo {
  const user = mapUser(value)
  if (!user.id) throw new ApiError('服务端返回的登录用户信息不完整')
  return user
}
