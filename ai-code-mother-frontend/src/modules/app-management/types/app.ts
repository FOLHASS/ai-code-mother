/** Stable string identity used by feature boundaries for Java Long IDs. */
export type AppId = string

/**
 * The application fields that are meaningful to feature UI.
 * This type deliberately uses a string ID even though the generated API still
 * describes the wire value as number.
 */
export type AppSummary = {
  id: AppId
  appName?: string
  cover?: string
  initPrompt?: string
  codeGenType?: string
  deployKey?: string
  deployedTime?: string
  userId?: AppId
  createTime?: string
  updateTime?: string
}

/** Capabilities derived by the workbench from the current user and application. */
export type AppPermissions = {
  canInteract: boolean
  canReadHistory: boolean
}

/** Snapshot passed between application-management and workbench features. */
export type AppContext = {
  appId: AppId
  app: AppSummary | null
  permissions: AppPermissions
}

/** Convert a generated API value into the string-ID domain snapshot. */
export function toAppSummary(app: API.AppVO | null | undefined): AppSummary | null {
  if (!app?.id) return null
  return {
    id: String(app.id),
    appName: app.appName,
    cover: app.cover,
    initPrompt: app.initPrompt,
    codeGenType: app.codeGenType,
    deployKey: app.deployKey,
    deployedTime: app.deployedTime,
    userId: app.userId == null ? undefined : String(app.userId),
    createTime: app.createTime,
    updateTime: app.updateTime,
  }
}
