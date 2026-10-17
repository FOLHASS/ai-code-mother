import { USER_ROLE } from '@/shared/domain/constants.ts'

export type AppPermissionId = string | number | null | undefined
export type AppPermissionSubject = { id?: AppPermissionId; role?: string | null }
export type AppPermissionResource = { ownerId?: AppPermissionId }
export type AppAccessPolicy = {
  isAuthenticated: boolean
  isOwner: boolean
  isAdmin: boolean
  canReadHistory: boolean
  canInteract: boolean
  canGenerate: boolean
  canEdit: boolean
  canDelete: boolean
  canDeploy: boolean
  canDownload: boolean
}

/** 根据用户角色和应用归属统一计算各项操作权限。 */
export class AppPermissionPolicyService {
  /** 根据当前用户和应用归属计算可执行权限。 */
  evaluate(
    subject: AppPermissionSubject | null | undefined,
    resource: AppPermissionResource | null | undefined,
  ): AppAccessPolicy {
    const hasId = (id: AppPermissionId) => id != null && String(id).trim().length > 0
    const isAuthenticated = hasId(subject?.id)
    const isAdmin = isAuthenticated && subject?.role === USER_ROLE.ADMIN
    const isOwner =
      isAuthenticated &&
      hasId(resource?.ownerId) &&
      String(subject?.id) === String(resource?.ownerId)
    return {
      isAuthenticated,
      isOwner,
      isAdmin,
      canReadHistory: isOwner || isAdmin,
      canInteract: isOwner,
      canGenerate: isOwner,
      canEdit: isOwner || isAdmin,
      canDelete: isOwner,
      canDeploy: isOwner,
      canDownload: isOwner,
    }
  }
}
export const appPermissionPolicy = new AppPermissionPolicyService()
