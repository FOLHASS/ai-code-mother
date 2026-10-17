import { readonly, shallowRef, type DeepReadonly } from 'vue'
import type { ChatMessage } from '../types/chatMessage.ts'
import type { ChatHistoryRecord } from '@/shared/domain/models.ts'
import { ChatHistoryMapperService } from './ChatHistoryMapperService.ts'

export type ChatMessageView = DeepReadonly<ChatMessage>
/** 维护聊天消息顺序，并合并新消息与历史记录。 */
export class ChatTimeline {
  /** 保存聊天时间线的响应式内部状态。 */
  private readonly state = shallowRef<ChatMessage[]>([])
  /** 提供接口数据与前端模型之间的映射能力。 */
  private readonly mapper = new ChatHistoryMapperService()
  /** 只读暴露按时间排列的聊天消息。 */
  readonly messages = readonly(this.state)
  /** 清空时间线中的所有消息。 */
  reset = (): void => {
    this.state.value = []
  }
  /** 将新消息追加到时间线末尾。 */
  append = (...messages: ChatMessage[]): void => {
    this.state.value = [
      ...this.state.value,
      ...messages.map((message) => ({
        ...message,
        toolCalls: message.toolCalls?.map((tool) => ({ ...tool })),
      })),
    ]
  }
  /** 按消息 ID 更新已有消息内容。 */
  update = (message: ChatMessage): void => {
    this.state.value = this.state.value.map((item) =>
      item.id === message.id
        ? { ...message, toolCalls: message.toolCalls?.map((tool) => ({ ...tool })) }
        : item,
    )
  }
  /** 按时间顺序合并历史消息并避免重复。 */
  mergeHistory = (records: ChatHistoryRecord[], prepend: boolean): void => {
    this.state.value = this.mapper.merge(prepend ? this.state.value : [], records)
  }
}
export type ChatTimelinePort = Pick<ChatTimeline, 'append' | 'update'>
