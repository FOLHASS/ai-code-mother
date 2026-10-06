<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, onUpdated, ref } from 'vue'
import { message } from 'ant-design-vue'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/common'
import MarkdownIt from 'markdown-it'
import { useRoute, useRouter } from 'vue-router'

import { adminGetAppVoById, deploy, getAppVoById, streamChatToGenCode } from '@/api/appController.ts'
import logoUrl from '@/assets/logo.png'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'
import { getPreviewUrl } from '@/utils/app.ts'

type ChatMessage = {
  id: number
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
  error?: boolean
}

const route = useRoute()
const router = useRouter()
const loginUserStore = useLoginUserStore()
const app = ref<API.AppVO | null>(null)
const messages = ref<ChatMessage[]>([])
const input = ref('')
const isLoadingApp = ref(true)
const isStreaming = ref(false)
const isDeploying = ref(false)
const previewUrl = ref('')
const deployedUrl = ref('')
const messageList = ref<HTMLElement | null>(null)
const hasSentInitialPrompt = ref(false)
const hasGeneratedWebsite = ref(false)
let messageId = 0

const escapeHtml = (value: string) => value
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

const appId = computed(() => String(route.params.id || ''))
const appTitle = computed(() => app.value?.appName || '未命名应用')
const isLoggedIn = computed(() => Boolean(loginUserStore.loginUser.id))
const isOwner = computed(() => Boolean(app.value?.userId && app.value.userId === loginUserStore.loginUser.id))
const canInteract = computed(() => isOwner.value)
const generationStorageKey = computed(() => `app-generated:${appId.value}`)

const scrollToBottom = async () => {
  await nextTick()
  if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
}

const appendStreamChunk = (assistantMessage: ChatMessage, chunk: string) => {
  if (!chunk) return
  assistantMessage.content += chunk
  void scrollToBottom()
}

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
    await navigator.clipboard.writeText(code)
    message.success('代码已复制')
  } catch {
    message.error('复制失败，请手动选择代码')
  }
}

const loadApp = async () => {
  if (!appId.value) {
    await router.replace('/')
    return
  }
  isLoadingApp.value = true
  try {
    const response = loginUserStore.loginUser.userRole === 'admin'
      ? await adminGetAppVoById({ id: appId.value })
      : await getAppVoById({ id: appId.value })
    if (response.data.code !== 0 || !response.data.data) {
      message.error(response.data.message || '应用不存在或无权访问')
      await router.replace('/')
      return
    }
    app.value = response.data.data
    hasSentInitialPrompt.value = localStorage.getItem(generationStorageKey.value) === '1'
    hasGeneratedWebsite.value = hasSentInitialPrompt.value && Boolean(app.value.codeGenType)
    if (hasGeneratedWebsite.value && app.value.codeGenType) {
      previewUrl.value = getPreviewUrl(app.value)
    }

    const initialPrompt = typeof route.query.prompt === 'string' ? route.query.prompt.trim() : ''
    if (!hasSentInitialPrompt.value && canInteract.value && (initialPrompt || app.value.initPrompt?.trim())) {
      hasSentInitialPrompt.value = true
      await sendMessage(initialPrompt || app.value.initPrompt || '', true)
      if (route.query.prompt) {
        await router.replace({ path: route.path, query: {} })
      }
    }
  } catch {
    message.error('应用加载失败，请稍后重试')
    await router.replace('/')
  } finally {
    isLoadingApp.value = false
  }
}

const sendMessage = async (value = input.value, isInitial = false) => {
  const content = value.trim()
  if (!content || isStreaming.value || !app.value?.id || !canInteract.value) return
  if (!isInitial) input.value = ''

  messages.value.push({ id: ++messageId, role: 'user', content })
  const assistantMessage: ChatMessage = { id: ++messageId, role: 'assistant', content: '', loading: true }
  messages.value.push(assistantMessage)
  isStreaming.value = true
  await scrollToBottom()

  try {
    for await (const chunk of streamChatToGenCode({ appId: app.value.id, message: content })) {
      appendStreamChunk(assistantMessage, chunk)
    }
    assistantMessage.loading = false
    localStorage.setItem(generationStorageKey.value, '1')
    hasGeneratedWebsite.value = true
    previewUrl.value = getPreviewUrl(app.value, true)
  } catch (error) {
    assistantMessage.loading = false
    assistantMessage.error = true
    assistantMessage.content = error instanceof Error ? error.message : '生成失败，请稍后重试'
    message.error(assistantMessage.content)
  } finally {
    isStreaming.value = false
    await scrollToBottom()
  }
}

const handleDeploy = async () => {
  if (!app.value?.id || isDeploying.value || !canInteract.value) return
  isDeploying.value = true
  try {
    const response = await deploy({ appId: app.value.id })
    if (response.data.code !== 0 || !response.data.data) {
      message.error(response.data.message || '部署失败')
      return
    }
    deployedUrl.value = response.data.data
    message.success('应用部署成功')
  } catch {
    message.error('网络异常，应用部署失败')
  } finally {
    isDeploying.value = false
  }
}

const openDeployUrl = () => {
  if (deployedUrl.value) window.open(deployedUrl.value, '_blank', 'noopener,noreferrer')
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void sendMessage()
  }
}

onMounted(async () => {
  await loginUserStore.fetchLoginUser()
  await loadApp()
})

onUnmounted(() => undefined)

onUpdated(() => void scrollToBottom())
</script>

<template>
  <main class="chat-page">
    <header class="chat-header">
      <button class="back-button" type="button" aria-label="返回首页" @click="router.push('/')">←</button>
      <div class="chat-brand">
        <img :src="logoUrl" alt="" />
        <div><strong>{{ appTitle }}</strong><span>AI 应用生成工作台</span></div>
      </div>
      <div class="header-actions">
        <button v-if="deployedUrl" class="deployed-link" type="button" @click="openDeployUrl">打开网站 ↗</button>
        <button class="deploy-button" type="button" :disabled="isDeploying || isStreaming || !previewUrl || !canInteract" @click="handleDeploy">
          <span aria-hidden="true">◈</span>{{ isDeploying ? '部署中...' : '部署' }}
        </button>
      </div>
    </header>

    <div class="chat-workspace">
      <section class="conversation-panel">
        <div class="conversation-heading"><div><p>CONVERSATION</p><h1>和 AI 一起完善应用</h1></div><span class="online-indicator"><i></i> {{ isLoadingApp ? '连接中' : isStreaming ? '生成中' : 'AI 在线' }}</span></div>
        <div ref="messageList" class="message-list">
          <div v-if="!messages.length" class="conversation-empty"><span class="empty-orbit"><i></i></span><strong>{{ isLoadingApp ? '正在连接应用' : '从一句话开始' }}</strong><p>{{ isLoadingApp ? '马上开始生成对话' : '告诉 AI 你想怎样调整这个应用' }}</p></div>
          <article v-for="item in messages" :key="item.id" class="message-row" :class="`message-${item.role}`">
            <img v-if="item.role === 'assistant'" :src="logoUrl" alt="AI" class="message-avatar" />
            <div class="message-body"><div class="message-meta">{{ item.role === 'user' ? '你' : 'AI 助手' }}</div><div class="message-bubble" :class="{ 'message-error': item.error }"><span v-if="!item.content && item.loading" class="typing-dots"><i></i><i></i><i></i></span><div v-else-if="item.role === 'assistant'" class="markdown-content" v-html="renderAssistantMessage(item.content)" @click="copyCode"></div><pre v-else>{{ item.content }}</pre><span v-if="item.loading && item.content" class="streaming-cursor"></span></div></div>
          </article>
        </div>
        <form class="chat-composer" @submit.prevent="sendMessage()">
          <textarea v-model="input" :disabled="isLoadingApp || isStreaming || !isLoggedIn || !canInteract" rows="3" :placeholder="canInteract ? '描述更详细，页面会更具体。按 Enter 发送，Shift + Enter 换行' : '当前为只读预览，仅应用创建者可以继续对话'" @keydown="handleKeydown"></textarea>
          <div class="composer-footer"><span>{{ isStreaming ? 'AI 正在生成，请稍候...' : canInteract ? '支持连续对话迭代' : '管理员查看模式' }}</span><button type="submit" :disabled="isStreaming || !input.trim() || !canInteract"><span aria-hidden="true">↑</span></button></div>
        </form>
      </section>

      <section class="preview-panel">
        <div class="preview-heading"><div><p>LIVE PREVIEW</p><h2>生成后的网站展示</h2></div><span v-if="hasGeneratedWebsite" class="preview-status"><i></i> 已生成</span></div>
        <div class="browser-frame">
          <div class="browser-toolbar"><span class="browser-dots"><i></i><i></i><i></i></span><div class="browser-address">localhost / {{ app?.codeGenType || 'preview' }}</div><span class="browser-refresh">↻</span></div>
          <div class="browser-content">
            <iframe v-if="hasGeneratedWebsite && previewUrl" :src="previewUrl" title="生成的网站预览" sandbox="allow-forms allow-modals allow-popups allow-scripts allow-same-origin"></iframe>
            <div v-else class="preview-empty"><span class="preview-loader"><i></i><i></i><i></i></span><strong>{{ isStreaming ? '正在解析生成的网站' : '网站预览会出现在这里' }}</strong><p>{{ isStreaming ? '代码流式输出完成后，预览会自动加载' : '等待左侧 AI 完成代码生成后自动展示' }}</p></div>
          </div>
        </div>
        <div class="preview-footnote"><span>⌘</span><p>生成完成后会自动刷新预览，你可以继续对话优化页面。</p></div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.chat-page { display: flex; flex-direction: column; height: 100vh; min-height: 0; overflow: hidden; color: #20364f; background: #f6f9fb; }
.chat-header { display: flex; align-items: center; gap: 18px; min-height: 70px; padding: 0 28px; background: #fff; border-bottom: 1px solid #e7eef2; }
.back-button { width: 35px; height: 35px; color: #54717b; font-size: 22px; background: #f5fafb; border: 1px solid #e3edef; border-radius: 9px; cursor: pointer; }
.chat-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.chat-brand img { width: 34px; height: 34px; border-radius: 10px; }
.chat-brand div { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.chat-brand strong { overflow: hidden; color: #1b3144; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
.chat-brand span { color: #9baab2; font-size: 11px; }
.header-actions { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.deployed-link { color: #198979; font: inherit; font-size: 12px; background: none; border: 0; cursor: pointer; }
.deploy-button { display: inline-flex; align-items: center; gap: 7px; min-height: 38px; padding: 0 16px; color: #fff; font: inherit; font-size: 13px; background: #1b2733; border: 0; border-radius: 8px; cursor: pointer; }
.deploy-button:disabled { cursor: not-allowed; opacity: .45; }
.chat-workspace { display: grid; flex: 1; grid-template-columns: minmax(360px, .82fr) minmax(450px, 1.18fr); gap: 18px; min-height: 0; padding: 20px; overflow: hidden; }
.conversation-panel, .preview-panel { display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: #fff; border: 1px solid #e5edf0; border-radius: 14px; box-shadow: 0 10px 30px rgb(34 77 99 / 4%); }
.conversation-heading, .preview-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 22px 24px 17px; border-bottom: 1px solid #edf2f4; }
.conversation-heading p, .preview-heading p { margin: 0 0 5px; color: #3ea18e; font-size: 10px; font-weight: 750; letter-spacing: .14em; }
.conversation-heading h1, .preview-heading h2 { margin: 0; color: #1c344a; font-size: 18px; font-weight: 650; }
.online-indicator, .preview-status { display: inline-flex; align-items: center; gap: 6px; padding: 7px 9px; color: #328675; font-size: 11px; background: #f0faf7; border-radius: 999px; white-space: nowrap; }
.online-indicator i, .preview-status i { width: 6px; height: 6px; background: #29b78a; border-radius: 50%; }
.message-list { flex: 1; min-height: 0; padding: 18px 20px; overflow-y: auto; scroll-behavior: smooth; }
.conversation-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 240px; color: #9eacb3; text-align: center; }
.conversation-empty span { display: grid; width: 44px; height: 44px; margin-bottom: 12px; color: #fff; font-size: 23px; place-items: center; background: #57baa9; border-radius: 14px; }
.empty-orbit::before, .empty-orbit::after { width: 14px; height: 14px; content: ''; border: 2px solid rgb(255 255 255 / 65%); border-radius: 50%; animation: orbit 1.8s linear infinite; }
.empty-orbit::after { position: absolute; animation-direction: reverse; }
.conversation-empty strong { color: #44616e; font-size: 14px; }
.conversation-empty p { margin: 7px 0 0; font-size: 12px; }
.message-row { display: flex; gap: 9px; max-width: 94%; margin-bottom: 18px; }
.message-user { flex-direction: row-reverse; margin-left: auto; }
.message-avatar { flex: 0 0 29px; width: 29px; height: 29px; margin-top: 20px; border-radius: 9px; }
.message-body { min-width: 0; }
.message-user .message-body { text-align: right; }
.message-meta { margin: 0 3px 6px; color: #9ba9b1; font-size: 10px; }
.message-bubble { padding: 11px 13px; color: #455b69; font-size: 13px; line-height: 1.65; text-align: left; background: #f4f8f8; border-radius: 4px 12px 12px 12px; }
.message-user .message-bubble { color: #fff; background: #2b9387; border-radius: 12px 4px 12px 12px; }
.message-bubble pre { max-width: 100%; margin: 0; overflow-x: auto; overflow-wrap: anywhere; white-space: pre-wrap; font: inherit; }
.markdown-content :deep(p) { margin: 0 0 10px; }.markdown-content :deep(p:last-child) { margin-bottom: 0; }
.markdown-content :deep(ul), .markdown-content :deep(ol) { margin: 7px 0 10px; padding-left: 21px; }.markdown-content :deep(li + li) { margin-top: 3px; }
.markdown-content :deep(blockquote) { margin: 9px 0; padding-left: 11px; color: #6c7e87; border-left: 3px solid #9dcac2; }
.markdown-content :deep(a) { color: #168777; text-decoration: underline; }.message-user .markdown-content :deep(a) { color: #fff; }
.markdown-content :deep(code:not(pre code)) { padding: 2px 5px; color: #a24e68; font-size: .92em; background: #e9eff0; border-radius: 4px; }
.markdown-content :deep(pre) { position: relative; margin: 10px 0 3px; padding: 14px; color: #d9e7ea; line-height: 1.55; white-space: pre; background: #17232d; border: 1px solid #29414a; border-radius: 8px; }
.markdown-content :deep(pre)::before { display: block; margin-bottom: 8px; color: #8da5ac; font-size: 10px; content: 'CODE'; letter-spacing: .12em; }
.markdown-content :deep(pre code) { color: inherit; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.markdown-content :deep(.hljs-comment), .markdown-content :deep(.hljs-quote) { color: #78909c; }.markdown-content :deep(.hljs-keyword), .markdown-content :deep(.hljs-selector-tag) { color: #d8a0ff; }.markdown-content :deep(.hljs-string), .markdown-content :deep(.hljs-attr) { color: #a7d98c; }.markdown-content :deep(.hljs-title), .markdown-content :deep(.hljs-name) { color: #78d5e8; }.markdown-content :deep(.hljs-number), .markdown-content :deep(.hljs-literal) { color: #f2c27d; }
.message-error { color: #b6535d; background: #fff1f1; }
.typing-dots { display: inline-flex; gap: 4px; padding: 4px 2px; }
.typing-dots i { width: 5px; height: 5px; background: #73a69f; border-radius: 50%; animation: blink 1s infinite; }
.typing-dots i:nth-child(2) { animation-delay: .15s; }.typing-dots i:nth-child(3) { animation-delay: .3s; }
.streaming-cursor { display: inline-block; width: 6px; height: 14px; margin-left: 3px; vertical-align: -2px; background: #40a797; animation: blink 1s infinite; }
.chat-composer { margin: 0 18px 18px; padding: 12px 13px 10px; background: #fbfdfd; border: 1px solid #dfeaec; border-radius: 12px; }
.chat-composer textarea { display: block; width: 100%; padding: 0; color: #304d5b; font: inherit; font-size: 13px; line-height: 1.55; background: transparent; border: 0; outline: 0; resize: none; }
.chat-composer textarea::placeholder { color: #a6b2b8; }
.composer-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; color: #9aabb2; font-size: 10px; }
.composer-footer button { display: grid; width: 32px; height: 32px; color: #fff; font-size: 20px; place-items: center; background: #819196; border: 0; border-radius: 50%; cursor: pointer; }
.composer-footer button:disabled { cursor: not-allowed; opacity: .45; }
.preview-panel { padding-bottom: 18px; }
.browser-frame { display: flex; flex: 1; flex-direction: column; min-height: 350px; margin: 20px; overflow: hidden; background: #f6f8f9; border: 1px solid #e0e8eb; border-radius: 10px; }
.browser-toolbar { display: flex; align-items: center; gap: 12px; height: 38px; padding: 0 13px; background: #edf3f4; border-bottom: 1px solid #dde7e9; }
.browser-dots { display: flex; gap: 5px; }.browser-dots i { width: 7px; height: 7px; background: #c1d0d2; border-radius: 50%; }.browser-dots i:first-child { background: #f0a19b; }.browser-dots i:nth-child(2) { background: #e9cf8e; }.browser-dots i:last-child { background: #94d1b7; }
.browser-address { flex: 1; padding: 5px 10px; overflow: hidden; color: #99a7ad; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; background: #f9fbfb; border-radius: 5px; }.browser-refresh { color: #91a1a7; font-size: 16px; }
.browser-content { position: relative; flex: 1; min-height: 0; background: #fff; }.browser-content iframe { width: 100%; height: 100%; min-height: 0; border: 0; }
.preview-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 240px; color: #9baab0; text-align: center; }.preview-empty strong { color: #506974; font-size: 14px; }.preview-empty p { margin: 7px 0 0; font-size: 12px; }
.preview-loader { display: inline-flex; align-items: center; justify-content: center; gap: 5px; width: 56px; height: 56px; margin-bottom: 15px; background: #edf9f5; border-radius: 17px; }.preview-loader i { width: 7px; height: 7px; background: #54ad9e; border-radius: 50%; animation: preview-pulse 1s ease-in-out infinite; }.preview-loader i:nth-child(2) { animation-delay: .15s; }.preview-loader i:nth-child(3) { animation-delay: .3s; }
.preview-footnote { display: flex; gap: 9px; margin: 0 20px; color: #9ba9af; font-size: 11px; }.preview-footnote span { color: #54ad9e; }.preview-footnote p { margin: 0; }
.chat-loading { display: none; }
@keyframes blink { 0%, 100% { opacity: .25; } 50% { opacity: 1; } } @keyframes spin { to { transform: rotate(360deg); } } @keyframes orbit { to { transform: rotate(360deg) translateX(7px) rotate(-360deg); } } @keyframes preview-pulse { 0%, 100% { transform: translateY(3px); opacity: .4; } 50% { transform: translateY(-3px); opacity: 1; } }
@media (max-width: 900px) { .chat-workspace { grid-template-columns: 1fr; overflow-y: auto; }.conversation-panel, .preview-panel { min-height: 520px; }.message-list { max-height: none; } }
@media (max-width: 560px) { .chat-header { padding: 0 14px; gap: 10px; }.chat-brand span { display: none; }.deployed-link { display: none; }.chat-workspace { padding: 10px; }.conversation-heading, .preview-heading { padding: 17px 16px 14px; }.browser-frame { margin: 12px; }.preview-footnote { margin: 0 12px; } }
</style>
