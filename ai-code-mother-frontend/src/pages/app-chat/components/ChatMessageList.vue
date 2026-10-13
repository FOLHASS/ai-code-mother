<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/common'
import MarkdownIt from 'markdown-it'

import logoUrl from '@/assets/logo.png'
import { formatDateTime } from '@/utils/app.ts'
import type { ChatMessage } from '@/utils/chatHistory.ts'

defineProps<{
  messages: ChatMessage[]
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

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  highlight: (code, language) => {
    if (language && hljs.getLanguage(language)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language }).value}</code></pre>`
      } catch {
        // Fall through to escaped plain text for incomplete streaming code.
      }
    }
    return `<pre class="hljs"><code>${escapeHtml(code)}</code></pre>`
  },
})

const renderAssistantMessage = (content: string) => {
  if (!content) return ''
  return DOMPurify.sanitize(markdown.render(content), {
    ADD_ATTR: ['target', 'rel'],
  })
}

const copyCode = async (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const code = target.closest('pre')?.querySelector('code')?.textContent || ''
  if (!code) return
  try {
    // 当前复制禁用
    // await navigator.clipboard.writeText(code)
    // message.success('代码已复制')
  } catch {
    message.error('复制失败，请手动选择代码')
  }
}
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
    <article
      v-for="item in messages"
      :key="item.id"
      :class="`message-${item.role}`"
      class="message-row"
    >
      <img v-if="item.role === 'assistant'" :src="logoUrl" alt="AI" class="message-avatar" />
      <div class="message-body">
        <div class="message-meta">
          <span>{{ item.role === 'user' ? userMessageLabel : 'AI 助手' }}</span
          ><time v-if="item.createTime" :datetime="item.createTime">{{
            formatDateTime(item.createTime)
          }}</time>
        </div>
        <div :class="{ 'message-error': item.error }" class="message-bubble">
          <span v-if="!item.content && item.loading" class="typing-dots"
            ><i></i><i></i><i></i
          ></span>
          <div
            v-else-if="item.role === 'assistant'"
            class="markdown-content"
            @click="copyCode"
            v-html="renderAssistantMessage(item.content)"
          ></div>
          <pre v-else>{{ item.content }}</pre>
          <span
            v-if="item.role === 'assistant' && item.loading && item.content"
            class="streaming-cursor"
          ></span>
          <div v-if="item.toolCalls?.length" class="tool-calls" aria-live="polite">
            <div
              v-for="tool in item.toolCalls"
              :key="tool.id"
              :class="{ 'tool-call--failed': tool.status === 'failed' }"
              class="tool-call"
            >
              <span>{{ tool.name }}</span>
              <span>{{
                tool.status === 'running'
                  ? '执行中…'
                  : tool.status === 'failed'
                    ? '执行失败'
                    : '已完成'
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
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
.message-row {
  display: flex;
  gap: 9px;
  max-width: 94%;
  margin-bottom: 18px;
}
.message-user {
  flex-direction: row-reverse;
  margin-left: auto;
}
.message-avatar {
  flex: 0 0 29px;
  width: 29px;
  height: 29px;
  margin-top: 20px;
  border-radius: 9px;
}
.message-body {
  min-width: 0;
}
.message-user .message-body {
  text-align: right;
}
.message-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 3px 6px;
  color: #9ba9b1;
  font-size: 10px;
}
.message-user .message-meta {
  justify-content: flex-end;
}
.message-bubble {
  padding: 11px 13px;
  color: #455b69;
  font-size: 13px;
  line-height: 1.65;
  text-align: left;
  background: #f4f8f8;
  border-radius: 4px 12px 12px 12px;
}
.message-user .message-bubble {
  color: #fff;
  background: #2b9387;
  border-radius: 12px 4px 12px 12px;
}
.message-bubble pre {
  max-width: 100%;
  margin: 0;
  overflow-x: auto;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  font: inherit;
}
.markdown-content :deep(p) {
  margin: 0 0 10px;
}
.markdown-content :deep(p:last-child) {
  margin-bottom: 0;
}
.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 7px 0 10px;
  padding-left: 21px;
}
.markdown-content :deep(li + li) {
  margin-top: 3px;
}
.markdown-content :deep(blockquote) {
  margin: 9px 0;
  padding-left: 11px;
  color: #6c7e87;
  border-left: 3px solid #9dcac2;
}
.markdown-content :deep(a) {
  color: #168777;
  text-decoration: underline;
}
.message-user .markdown-content :deep(a) {
  color: #fff;
}
.markdown-content :deep(code:not(pre code)) {
  padding: 2px 5px;
  color: #a24e68;
  font-size: 0.92em;
  background: #e9eff0;
  border-radius: 4px;
}
.markdown-content :deep(pre) {
  position: relative;
  margin: 10px 0 3px;
  padding: 14px;
  color: #d9e7ea;
  line-height: 1.55;
  white-space: pre;
  background: #17232d;
  border: 1px solid #29414a;
  border-radius: 8px;
}
.markdown-content :deep(pre)::before {
  display: block;
  margin-bottom: 8px;
  color: #8da5ac;
  font-size: 10px;
  content: 'CODE';
  letter-spacing: 0.12em;
}
.markdown-content :deep(pre code) {
  color: inherit;
  font:
    12px/1.55 ui-monospace,
    SFMono-Regular,
    Menlo,
    Consolas,
    monospace;
}
.markdown-content :deep(.hljs-comment),
.markdown-content :deep(.hljs-quote) {
  color: #78909c;
}
.markdown-content :deep(.hljs-keyword),
.markdown-content :deep(.hljs-selector-tag) {
  color: #d8a0ff;
}
.markdown-content :deep(.hljs-string),
.markdown-content :deep(.hljs-attr) {
  color: #a7d98c;
}
.markdown-content :deep(.hljs-title),
.markdown-content :deep(.hljs-name) {
  color: #78d5e8;
}
.markdown-content :deep(.hljs-number),
.markdown-content :deep(.hljs-literal) {
  color: #f2c27d;
}
.message-error {
  color: #b6535d;
  background: #fff1f1;
}
.tool-calls {
  display: grid;
  gap: 5px;
  margin-top: 8px;
}
.tool-call {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 5px 8px;
  color: #328675;
  font-size: 12px;
  background: #eaf4f1;
  border-radius: 6px;
}
.tool-call--failed {
  color: #b6535d;
  background: #fff1f1;
}
.typing-dots {
  display: inline-flex;
  gap: 4px;
  padding: 4px 2px;
}
.typing-dots i {
  width: 5px;
  height: 5px;
  background: #73a69f;
  border-radius: 50%;
  animation: blink 1s infinite;
}
.typing-dots i:nth-child(2) {
  animation-delay: 0.15s;
}
.typing-dots i:nth-child(3) {
  animation-delay: 0.3s;
}
.streaming-cursor {
  display: inline-block;
  width: 6px;
  height: 14px;
  margin-left: 3px;
  vertical-align: -2px;
  background: #40a797;
  animation: blink 1s infinite;
}
@keyframes blink {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 1;
  }
}
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
