import type { Router } from 'vue-router'
import type { SessionUserInfo } from './domain/models.ts'

/**
 * 实现通知类型接口
 */
export type Notifier = {
  success: (text: string) => void
  warning: (text: string) => void
  error: (text: string) => void
}
/**
 * 约束当前路由能执行的方法函数 push、replace、back
 */
export type RouterPort = Pick<Router, 'push' | 'replace' | 'back'>
/**
 * 封装session相关的信息-用户信息
 * 1. 用户信息
 * 2. 获取当前登录用户
 * 3. 设置当前登录用户
 * 4. 清除当前session信息
 */
export type UserSession = {
  readonly loginUser: SessionUserInfo
  fetchLoginUser: () => Promise<void>
  setLoginUser: (user: SessionUserInfo) => void
  clearSession: () => void
}
/**
 * 约束确认框的接口
 */
export type Confirmation = (options: {
  title: string
  content: string
  onOk: () => Promise<void>
  okText?: string
  cancelText?: string
  okButtonProps?: { danger?: boolean }
}) => void

/**
 * 一个页面当中可能需要用到的常用依赖
 * 1. 用户的会话管理
 * 2. 路由管理
 * 3. 通知管理
 * 4. 确认框管理
 */
export type ControllerCommonContext = {
  session: UserSession
  router: RouterPort
  notify: Notifier
  confirm: Confirmation
}
