import { message, Modal } from 'ant-design-vue'
import { AppApiClient } from '@/features/app-management/api'
import { UserApiClient } from '@/features/user-management/api'
import { ChatHistoryApiClient } from '@/features/ai-chat/api/ChatHistoryApiClient.ts'
import type { Notifier, Confirmation } from '@/shared/ports.ts'


/**
 * 统一初始化全局的各个模块的接口客户端
 */
export const appApi = new AppApiClient()
export const userApi = new UserApiClient()
export const chatHistoryApi = new ChatHistoryApiClient()

/**
 * 全局可调用的通知器-封装atd的message对象
 */
export const notifier: Notifier = {
  success: (text) => {
    void message.success(text)
  },
  warning: (text) => {
    void message.warning(text)
  },
  error: (text) => {
    void message.error(text)
  },
}
/** 显示操作确认提示并返回用户选择结果。 */
export const confirm: Confirmation = (options) => {
  Modal.confirm({ okText: '确认', cancelText: '取消', okButtonProps: { danger: true }, ...options })
}
