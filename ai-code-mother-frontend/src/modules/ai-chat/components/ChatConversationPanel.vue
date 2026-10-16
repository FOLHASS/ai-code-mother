<script setup lang="ts">
/**
 * 左侧对话区的组合组件：负责区域标题、消息时间线和输入器的布局。
 * 消息历史状态交给 ChatMessageList 展示，输入和可视化选择交给 ChatComposer 展示。
 * 不持有业务请求状态，父页面通过同一组 Props 驱动两个子组件，事件原样上送。
 */
import { computed } from 'vue'

import ChatComposer from '@/modules/ai-chat/components/ChatComposer.vue'
import ChatMessageList from '@/modules/ai-chat/components/ChatMessageList.vue'
import type { ChatMessage } from '@/modules/ai-chat/types/chatMessage.ts'
import type { ElementInfo } from '@/modules/preview-editor/types/editor.ts'

/**
 * modelValue 为父层拥有的输入草稿；messages 包含已加载历史及当前流式消息。
 * 加载/权限字段决定空态、重试及只读展示，编辑相关字段对应同一 iframe 选择快照。
 */
type Props = {
  modelValue: string
  messages: ChatMessage[]
  isLoadingApp: boolean
  isLoadingHistory: boolean
  historyError: string
  historyLoaded: boolean
  hasMoreHistory: boolean
  isStreaming: boolean
  isLoggedIn: boolean
  canInteract: boolean
  canReadHistory: boolean
  userMessageLabel: string
  canVisualEdit: boolean
  isEditMode: boolean
  selectedElement: ElementInfo | null
}
const props = defineProps<Props>()
/** 列表 DOM 就绪回传给滚动逻辑；其余事件分别请求历史、发送消息或切换/清除可视化编辑。 */
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'list-ready': [element: HTMLElement | null]
  'retry-history': []
  'load-history': []
  send: []
  'toggle-edit': []
  'clear-selection': []
}>()
// 用可写 computed 适配 v-model，子组件只发更新事件，不直接修改父组件传入的 Prop。
const input = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})
</script>

<template>
  <section class="conversation-panel">
    <div class="conversation-heading">
      <div>
        <p>CONVERSATION</p>
        <h1>和 AI 一起完善应用</h1>
      </div>
      <span class="online-indicator"
        ><i></i> {{ isLoadingApp ? '连接中' : isStreaming ? '生成中' : 'AI 在线' }}</span
      >
    </div>
    <ChatMessageList
      :messages="messages"
      :is-loading-app="isLoadingApp"
      :is-loading-history="isLoadingHistory"
      :history-error="historyError"
      :history-loaded="historyLoaded"
      :has-more-history="hasMoreHistory"
      :is-streaming="isStreaming"
      :can-interact="canInteract"
      :can-read-history="canReadHistory"
      :user-message-label="userMessageLabel"
      @list-ready="(element) => emit('list-ready', element)"
      @retry-history="emit('retry-history')"
      @load-history="emit('load-history')"
    />
    <ChatComposer
      v-model="input"
      :is-loading-app="isLoadingApp"
      :is-streaming="isStreaming"
      :is-logged-in="isLoggedIn"
      :can-interact="canInteract"
      :history-loaded="historyLoaded"
      :can-visual-edit="canVisualEdit"
      :is-edit-mode="isEditMode"
      :selected-element="selectedElement"
      @send="emit('send')"
      @toggle-edit="emit('toggle-edit')"
      @clear-selection="emit('clear-selection')"
    />
  </section>
</template>

<style scoped>
/* 标题与连接状态并排，内容本身由消息列表占据可伸缩区域，输入框固定在该面板底部。 */

.conversation-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 17px;
  border-bottom: 1px solid #edf2f4;
}
.conversation-heading p {
  margin: 0 0 5px;
  color: #3ea18e;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.14em;
}
.conversation-heading h1 {
  margin: 0;
  color: #1c344a;
  font-size: 18px;
  font-weight: 650;
}
.online-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  color: #328675;
  font-size: 11px;
  background: #f0faf7;
  border-radius: 999px;
  white-space: nowrap;
}
.online-indicator i {
  width: 6px;
  height: 6px;
  background: #29b78a;
  border-radius: 50%;
}
@media (max-width: 560px) {
  .conversation-heading {
    padding: 17px 16px 14px;
  }
}
</style>
