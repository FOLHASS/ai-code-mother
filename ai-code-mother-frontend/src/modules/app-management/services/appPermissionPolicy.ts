/**
 * 应用工作台的访问策略。该模块只接受身份和应用所有者信息，
 * 不依赖 Pinia、路由或 Vue，方便页面编排层和测试复用同一套规则。
 */

export type AppPermissionId = string | number | null | undefined

export type AppPermissionSubject = {
  id?: AppPermissionId
  role?: string | null
}

export type AppPermissionResource = {
  ownerId?: AppPermissionId
}

export type AppAccessPolicy = {
  isAuthenticated: boolean
  isOwner: boolean
  isAdmin: boolean
  canReadHistory: boolean
  canInteract: boolean
}

const hasId = (id: AppPermissionId): id is string | number =>
  id !== undefined && id !== null && String(id).trim().length > 0

/**
 * 计算应用页面的权限能力：创建者可操作自己的应用，管理员可读取历史，
 * 其他已登录用户只能浏览公开页面。ID 统一按字符串比较，避免 Long 精度损失。
 */
export const getAppAccessPolicy = (
  subject: AppPermissionSubject | null | undefined,
  resource: AppPermissionResource | null | undefined,
): AppAccessPolicy => {
  const userId = subject?.id
  const ownerId = resource?.ownerId
  const isAuthenticated = hasId(userId)
  const isAdmin = subject?.role === 'admin'
  const isOwner = isAuthenticated && hasId(ownerId) && String(userId) === String(ownerId)

  return {
    isAuthenticated,
    isOwner,
    isAdmin,
    canReadHistory: isOwner || isAdmin,
    canInteract: isOwner,
  }
}
