<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { ChatMessageView } from '../services/ChatTimeline.ts'
import ChatMessageItem from './ChatMessageItem.vue'

defineProps<{
  messages: readonly ChatMessageView[]
  isLoadingApp: boolean
  isLoadingHistory: boolean
  historyError: string
  historyLoaded: boolean
  hasMoreHistory: boolean
  isStreaming: boolean
  canInteract: boolean
  canReadHistory: boolean
  userMessageLabel: string
}>()
const emit = defineEmits<{
  'list-ready': [element: HTMLElement | null]
  'retry-history': []
  'load-history': []
}>()
const messageList = ref<HTMLElement | null>(null)
onMounted(() => emit('list-ready', messageList.value))
onUnmounted(() => emit('list-ready', null))
</script>
<template>
  <div ref="messageList" class="message-list">
    <div v-if="canReadHistory" class="history-controls">
      <div v-if="historyError" class="history-error">
        <span>{{ historyError }}</span
        ><button :disabled="isLoadingHistory" type="button" @click="emit('retry-history')">
          重试
        </button>
      </div>
      <button
        v-else-if="hasMoreHistory"
        :disabled="isLoadingHistory"
        class="load-history-button"
        type="button"
        @click="emit('load-history')"
      >
        {{ isLoadingHistory ? '正在加载历史...' : '加载更多历史消息' }}
      </button>
      <span v-else-if="historyLoaded && messages.length" class="history-start"
        >已加载全部历史消息</span
      >
    </div>
    <div v-if="!messages.length" class="conversation-empty">
      <span class="empty-orbit"><i></i></span
      ><strong>{{
        isLoadingApp || isLoadingHistory
          ? '正在加载对话'
          : historyError
            ? '对话历史加载失败'
            : canInteract
              ? '继续完善你的作品'
              : '作品查看模式'
      }}</strong>
      <p>
        {{
          isLoadingApp || isLoadingHistory
            ? '正在读取应用和历史消息'
            : historyError
              ? '请重试后继续对话'
              : canReadHistory
                ? '发送消息，告诉 AI 你想怎样调整这个应用'
                : '对话历史仅应用创建者和管理员可见'
        }}
      </p>
    </div>
    <ChatMessageItem
      v-for="item in messages"
      :key="item.id"
      :item="item"
      :user-message-label="userMessageLabel"
    />
  </div>
</template>

<style scoped>
/* 该容器承载聊天独立滚动；关闭浏览器自动锚定，避免与历史模块的显式滚动补偿叠加。 */

.message-list {
  flex: 1;
  min-height: 0;
  padding: 18px 20px;
  overflow-y: auto;
  overflow-anchor: none;
}
.history-controls {
  margin-bottom: 18px;
  text-align: center;
}
.load-history-button,
.history-error button {
  padding: 6px 12px;
  color: #328675;
  font: inherit;
  font-size: 12px;
  background: #f0faf7;
  border: 1px solid #dcece7;
  border-radius: 7px;
  cursor: pointer;
}
.load-history-button:disabled,
.history-error button:disabled {
  cursor: wait;
  opacity: 0.6;
}
.history-start {
  color: #a0adb3;
  font-size: 11px;
}
.history-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #b6535d;
  font-size: 12px;
}
.conversation-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 240px;
  color: #9eacb3;
  text-align: center;
}
.conversation-empty span {
  display: grid;
  width: 44px;
  height: 44px;
  margin-bottom: 12px;
  color: #fff;
  font-size: 23px;
  place-items: center;
  background: #57baa9;
  border-radius: 14px;
}
.empty-orbit::before,
.empty-orbit::after {
  width: 14px;
  height: 14px;
  content: '';
  border: 2px solid rgb(255 255 255 / 65%);
  border-radius: 50%;
  animation: orbit 1.8s linear infinite;
}
.empty-orbit::after {
  position: absolute;
  animation-direction: reverse;
}
.conversation-empty strong {
  color: #44616e;
  font-size: 14px;
}
.conversation-empty p {
  margin: 7px 0 0;
  font-size: 12px;
}
/* 用户消息通过反向排列和自动左边距靠右，AI 消息保持头像和正文从左到右排列。 */

@keyframes orbit {
  to {
    transform: rotate(360deg) translateX(7px) rotate(-360deg);
  }
}
@media (max-width: 900px) {
  .message-list {
    max-height: none;
  }
}
</style>
