<script setup lang="ts">
/**
 * 聊天时间线展示：区分用户与 AI 消息，呈现历史加载、流式正文、思考过程和工具状态。
 * AI 正文经过 Markdown 渲染、代码高亮及 DOMPurify 清理后进入 v-html；用户文本保持文本插值。
 * 组件仅管理代码块展开状态和列表 DOM 引用，历史分页/流更新/滚动策略由上层 composable 拥有。
 */
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/common'
import MarkdownIt from 'markdown-it'

import logoUrl from '@/assets/logo.png'
import { formatDateTime } from '@/shared/formatters/date.ts'
import type { ChatMessage } from '../types/chatMessage.ts'

/** messages 保持创建时间升序；权限字段区分可读历史、可继续对话和仅查看作品的空态提示。 */
const props = defineProps<{
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
/** list-ready 供外层滚动逻辑绑定/解绑容器；重试与加载更多只上报意图，不在列表内发请求。 */
const emit = defineEmits<{
  'list-ready': [element: HTMLElement | null]
  'retry-history': []
  'load-history': []
}>()
// DOM 句柄只在挂载期间有效，卸载发 null 防止外层继续访问已脱离文档的滚动容器。
const messageList = ref<HTMLElement | null>(null)
onMounted(() => emit('list-ready', messageList.value))
onUnmounted(() => emit('list-ready', null))

/** 高亮器不支持语言或流式代码未完整时，转义原文，避免源码中的标签成为真实 DOM。 */
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

// 禁止 Markdown 原生 HTML，并保留换行与链接识别；最终输出仍需再经过清理器。
const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  // 显式语言已注册时才尝试高亮，不自动猜测；失败回退到安全转义后的普通代码。
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

// v-html 会在流式内容变化时重建子节点；按消息和代码块序号记住手动展开状态。
const expandedCodeBlocks = new Map<string, Set<number>>()
/** 每次渲染从零为当前消息中的代码块编号，展开集合跨流式重渲染复用。 */
type CodeBlockEnv = { codeBlockIndex: number; expanded: Set<number> }

/**
 * 用原生 details 包装 fenced/缩进代码块，默认折叠，只有用户曾展开的序号重新带 open。
 * 语言标签也必须转义；代码内容 html 已由 Markdown 原渲染器及高亮函数生成。
 */
const wrapCodeBlock = (html: string, language: string, env: CodeBlockEnv) => {
  const index = env.codeBlockIndex++
  const label = language.trim().split(/\s+/)[0]
  return `<details class="code-block" data-code-index="${index}"${env.expanded.has(index) ? ' open' : ''}><summary>代码块${label ? ` · ${escapeHtml(label)}` : ''}</summary>${html}</details>`
}

// 保留 Markdown 原始渲染能力，仅在外面追加折叠容器，避免重新实现代码语法和转义。
const renderFence = markdown.renderer.rules.fence
if (renderFence) {
  markdown.renderer.rules.fence = (tokens, index, options, env, renderer) =>
    wrapCodeBlock(
      renderFence(tokens, index, options, env, renderer),
      tokens[index]?.info || '',
      env as CodeBlockEnv,
    )
}
// 缩进代码块没有语言标记，也使用相同编号序列和折叠行为。
const renderIndentedCode = markdown.renderer.rules.code_block
if (renderIndentedCode) {
  markdown.renderer.rules.code_block = (tokens, index, options, env, renderer) =>
    wrapCodeBlock(
      renderIndentedCode(tokens, index, options, env, renderer),
      '',
      env as CodeBlockEnv,
    )
}

/**
 * 一条 AI 消息拥有独立的代码块序号和展开记忆；每次正文变化均重新渲染并清理 HTML。
 * DOMPurify 是进入 v-html 前的最终边界，允许链接目标属性但仍保留其默认危险内容过滤。
 */
const renderAssistantMessage = (item: ChatMessage) => {
  if (!item.content) return ''
  const env: CodeBlockEnv = {
    codeBlockIndex: 0,
    expanded: expandedCodeBlocks.get(item.id) ?? new Set<number>(),
  }
  return DOMPurify.sanitize(markdown.render(item.content, env), {
    ADD_ATTR: ['target', 'rel'],
  })
}

// 清空会话时释放旧消息的展开记录；单纯追加流式内容不会重置用户已做出的展开选择。
watch(
  () => props.messages,
  (messages) => {
    if (!messages.length) expandedCodeBlocks.clear()
  },
  { flush: 'sync' },
)

/**
 * details 的 toggle 由捕获阶段监听，动态 v-html 子节点无需分别绑定 Vue 事件。
 * 只处理本组件包装的代码块，并以消息 ID + 有效整数序号维护开关状态。
 */
const handleCodeBlockToggle = (event: Event, messageId: string) => {
  const block = event.target
  if (!(block instanceof HTMLDetailsElement) || !block.classList.contains('code-block')) return
  const index = Number(block.dataset.codeIndex)
  if (!Number.isInteger(index)) return
  const expanded = expandedCodeBlocks.get(messageId) ?? new Set<number>()
  if (block.open) expanded.add(index)
  else expanded.delete(index)
  if (expanded.size) expandedCodeBlocks.set(messageId, expanded)
  else expandedCodeBlocks.delete(messageId)
}

/**
 * 容器点击事件通过 closest 查找代码块；当前剪贴板写入与成功提示均已在原实现中停用。
 * 保留现有事件入口和异常提示，不把普通 Markdown 点击误当成有内容的代码复制。
 */
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
            @click="copyCode"
            @toggle.capture="handleCodeBlockToggle($event, item.id)"
            v-html="renderAssistantMessage(item)"
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
