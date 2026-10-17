import { message, Modal } from 'ant-design-vue'
import { AppApiClient } from '@/features/app-management/api'
import { UserApiClient } from '@/features/user-management/api'
import { ChatHistoryApiClient } from '@/features/ai-chat/api/ChatHistoryApiClient.ts'
import type { Notifier, Confirmation } from '@/shared/ports.ts'

export const appApi = new AppApiClient()
export const userApi = new UserApiClient()
export const chatHistoryApi = new ChatHistoryApiClient()
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
