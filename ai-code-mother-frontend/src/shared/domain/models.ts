export type EntityId = string

export type UserSummary = {
  id?: EntityId
  userAccount?: string
  userName?: string
  userAvatar?: string
  userProfile?: string
  userRole?: string
  createTime?: string
  updateTime?: string
}

export type SessionUser = UserSummary

export type AppSummary = {
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
  user?: UserSummary
}

export type PageQuery = {
  pageNum?: number
  pageSize?: number
  sortField?: string
  sortOrder?: string
}

export type PageResult<T> = {
  records: T[]
  totalRow: number
  pageNumber?: number
  pageSize?: number
  totalPage?: number
}

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
export type UserCreate = Omit<UserSummary, 'id' | 'createTime' | 'updateTime'>
export type UserUpdate = Omit<UserSummary, 'userAccount' | 'createTime' | 'updateTime'>
export type UserQuery = PageQuery &
  Pick<UserSummary, 'id' | 'userName' | 'userAccount' | 'userProfile' | 'userRole'>

export type ChatHistoryRecord = {
  id?: EntityId
  appId?: EntityId
  userId?: EntityId
  message?: string
  messageType?: string
  createTime?: string
  updateTime?: string
}
