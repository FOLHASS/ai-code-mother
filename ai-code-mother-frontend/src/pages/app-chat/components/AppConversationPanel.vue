<script setup lang="ts">
import { computed } from 'vue'

import type { ChatMessage } from '@/utils/chatHistory.ts'
import type { ElementInfo } from '@/utils/visualEditor.ts'
import ChatComposer from './ChatComposer.vue'
import ChatMessageList from './ChatMessageList.vue'

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
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'list-ready': [element: HTMLElement | null]
  'retry-history': []
  'load-history': []
  send: []
  'toggle-edit': []
  'clear-selection': []
}>()
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
