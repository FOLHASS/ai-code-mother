import type { Router } from 'vue-router'
import type { SessionUser } from './domain/models.ts'

export type Notifier = {
  success: (text: string) => void
  warning: (text: string) => void
  error: (text: string) => void
}
export type RouterPort = Pick<Router, 'push' | 'replace' | 'back'>
export type SessionPort = {
  readonly loginUser: SessionUser
  fetchLoginUser: () => Promise<void>
  setLoginUser: (user: SessionUser) => void
  clearSession: () => void
}
export type Confirmation = (options: {
  title: string
  content: string
  onOk: () => Promise<void>
  okText?: string
  cancelText?: string
  okButtonProps?: { danger?: boolean }
}) => void
export type PageDependencies = {
  session: SessionPort
  router: RouterPort
  notify: Notifier
  confirm: Confirmation
}
export type ControllerLifecycle = { start?: () => void | Promise<void>; dispose?: () => void }
