<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { ChatMessageView } from '../services/ChatTimeline.ts'
import { renderAssistantMarkdown } from '../services/markdownRenderer.ts'
import { formatDateTime } from '@/shared/formatters/date.ts'
import logoUrl from '@/assets/logo-display.png'

const props = defineProps<{ item: ChatMessageView; userMessageLabel: string }>()
const expanded = shallowRef<ReadonlySet<number>>(new Set())
const rendered = computed(() => renderAssistantMarkdown(props.item.content, expanded.value))
/** 切换代码块的展开或折叠状态。 */
const handleCodeBlockToggle = (event: Event) => {
  const block = event.target
  if (!(block instanceof HTMLDetailsElement) || !block.classList.contains('code-block')) return
  const index = Number(block.dataset.codeIndex)
  if (!Number.isInteger(index) || block.open === expanded.value.has(index)) return
  const next = new Set(expanded.value)
  if (block.open) next.add(index)
  else next.delete(index)
  expanded.value = next
}
</script>
<template>
  <article :class="`message-${item.role}`" class="message-row">
    <img v-if="item.role === 'assistant'" :src="logoUrl" alt="AI" class="message-avatar" />
    <div class="message-body">
      <div class="message-meta">
        <span>{{ item.role === 'user' ? userMessageLabel : 'AI 助手' }}</span
        ><time v-if="item.createTime" :datetime="item.createTime">{{
          formatDateTime(item.createTime)
        }}</time>
      </div>
      <div :class="{ 'message-error': item.error }" class="message-bubble">
        <span v-if="!item.content && item.loading" class="typing-dots"><i></i><i></i><i></i></span>
        <details
          v-if="item.role === 'assistant' && item.thinking"
          class="thinking-block"
          :open="!item.content"
        >
          <summary>思考过程</summary>
          <div class="thinking-content">{{ item.thinking }}</div>
        </details>
        <div
          v-if="item.role === 'assistant' && item.content"
          class="markdown-content"
          @toggle.capture="handleCodeBlockToggle($event)"
          v-html="rendered"
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
</template>
<style scoped>
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
/* 普通文本保留换行并允许长单词换行；代码块的后续规则会覆盖为横向滚动的 pre。 */

.message-bubble pre {
  max-width: 100%;
  margin: 0;
  overflow-x: auto;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  font: inherit;
}
/* v-html 创建的节点不带组件 scoped 标记，因此 Markdown 内部样式使用 :deep 定向覆盖。 */

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
/* 代码折叠外壳与内部高亮共用深色背景；展开状态由原生 details 属性及本地 Map 一起维护。 */

.markdown-content :deep(.code-block) {
  margin: 10px 0 3px;
  overflow: hidden;
  background: #17232d;
  border: 1px solid #29414a;
  border-radius: 8px;
}
.markdown-content :deep(.code-block summary) {
  padding: 8px 13px;
  color: #b6c9cf;
  font-size: 11px;
  cursor: pointer;
  user-select: none;
  background: #20323c;
}
.markdown-content :deep(.code-block summary)::after {
  float: right;
  color: #8da5ac;
  content: '展开代码';
}
.markdown-content :deep(.code-block[open] summary)::after {
  content: '收起代码';
}
.markdown-content :deep(.code-block pre) {
  margin: 0;
  padding: 14px;
  overflow-x: auto;
  color: #d9e7ea;
  line-height: 1.55;
  white-space: pre;
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
/* 思考信息使用独立 details：AI 正文出现前自动打开，正文出现后允许折叠阅读。 */

.thinking-block {
  margin-top: 6px;
  padding: 7px 10px;
  color: #6c7e87;
  font-size: 12px;
  line-height: 1.55;
  background: #f2f6f7;
  border: 1px solid #e0e9eb;
  border-radius: 7px;
}
.thinking-block summary {
  color: #328675;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}
.thinking-content {
  margin-top: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}
/* 工具调用只展示名称与运行/完成/失败状态，正文渲染不拼接工具参数或返回数据。 */

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
/* 空正文加载时显示跳动圆点，已有正文仍在生成时则使用独立的流式光标。 */

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
</style>
