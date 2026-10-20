/**
 * 业务ID的类型 全局定义
 */
export type EntityId = string

/**
 * 用户信息接口
 */
export type UserInfo = {
  id?: EntityId
  userAccount?: string
  userName?: string
  userAvatar?: string
  userProfile?: string
  userRole?: string
  createTime?: string
  updateTime?: string
}

/**
 * 供业务使用的数据接口
 */
export type SessionUserInfo = UserInfo
/**
 * 应用信息接口
 */
export type AppInfo = {
  id: EntityId
  appName?: string
  cover?: string
  initPrompt?: string
  codeGenType?: string
  deployKey?: string
  deployedTime?: string
  priority?: number
  userId?: EntityId
  editTime?: string
  createTime?: string
  updateTime?: string
  user?: UserInfo
}

/**
 * 分页查询接口
 */
export type PageQuery = {
  pageNum?: number
  pageSize?: number
  sortField?: string
  sortOrder?: string
}

/**
 * 分页查询的放回数据类型
 */
export type PageResult<T> = {
  records: T[]
  totalRow: number
  pageNumber?: number
  pageSize?: number
  totalPage?: number
}

/**
 * 应用查询接口
 */
export type AppQuery = PageQuery & {
  id?: EntityId
  userId?: EntityId
  appName?: string
  cover?: string
  initPrompt?: string
  codeGenType?: string
  deployKey?: string
  priority?: number
}

export type AppUpdate = { id?: EntityId; appName?: string; cover?: string; priority?: number }
export type AppCreate = { initPrompt?: string }
export type UserLogin = { userAccount?: string; userPassword?: string }
export type UserRegister = UserLogin & { checkPassword?: string }
export type UserCreate = Omit<UserInfo, 'id' | 'createTime' | 'updateTime'>
export type UserUpdate = Omit<UserInfo, 'userAccount' | 'createTime' | 'updateTime'>
export type UserQuery = PageQuery &
  Pick<UserInfo, 'id' | 'userName' | 'userAccount' | 'userProfile' | 'userRole'>

/**
 * 聊天信息的接口
 */
export type ChatHistoryRecord = {
  id?: EntityId
  appId?: EntityId
  userId?: EntityId
  message?: string
  messageType?: string
  createTime?: string
  updateTime?: string
}
