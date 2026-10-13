import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { afterEach, mock, test } from 'node:test'
import { ref } from 'vue'

import { asApiLongId } from '../src/utils/id.ts'

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/request') {
      return { url: 'data:text/javascript,export const API_BASE_URL = "http://localhost:8123/api"', shortCircuit: true }
    }
    if (specifier === '@/api/chatHistoryController.ts') {
      return { url: 'data:text/javascript,export const listAppChatHistoryByPage = (...args) => globalThis.__mockHistory(...args)', shortCircuit: true }
    }
    if (specifier.startsWith('@/utils/')) {
      return nextResolve(new URL(`../src/utils/${specifier.slice('@/utils/'.length)}`, import.meta.url).href, context)
    }
    return nextResolve(specifier, context)
  },
})
const { useAppGeneration } = await import('../src/pages/app-chat/composables/useAppGeneration.ts')
const { useAppHistory } = await import('../src/pages/app-chat/composables/useAppHistory.ts')
hooks.deregister()
afterEach(() => mock.restoreAll())

const appId = asApiLongId('9007199254740993')
const app = () => ref<API.AppVO | null>({ id: appId })

test('流式生成保留应用 ID、工具状态和完成后刷新预览；只读应用不发请求', async () => {
  const messages = ref<import('../src/utils/chatHistory.ts').ChatMessage[]>([])
  const canInteract = ref(false)
  const refreshed: boolean[] = []
  const generation = useAppGeneration({
    app: app(), canInteract, historyLoaded: ref(true), isLoadingHistory: ref(false),
    messages, messageList: ref(null), getVersion: () => 1,
    showPreview: async (cacheBust) => { refreshed.push(Boolean(cacheBust)) },
    scrollToBottom: async () => undefined,
  })
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response([
    'data: {"type":"ai_response","content":"已生成"}',
    'data: {"type":"tool_request","toolId":"one","toolName":"create_file"}',
    'data: {"type":"tool_executed","toolId":"one","toolName":"create_file","content":"{\\"success\\":true}"}',
    'event: done\ndata:',
    '',
  ].join('\n\n'), { headers: { 'Content-Type': 'text/event-stream' } }))

  await generation.sendMessage('请生成')
  assert.equal(fetchMock.mock.calls.length, 0)
  canInteract.value = true
  await generation.sendMessage('请生成')
  assert.equal(fetchMock.mock.calls.length, 1)
  assert.equal(new URL(String(fetchMock.mock.calls[0].arguments[0])).searchParams.get('appId'), String(appId))
  assert.deepEqual(messages.value.map(item => item.role), ['user', 'assistant'])
  assert.equal(messages.value[1].content, '已生成')
  assert.equal(messages.value[1].toolCalls?.[0]?.status, 'completed')
  assert.equal(generation.isStreaming.value, false)
  assert.deepEqual(refreshed, [true])
})

test('历史首次加载与向前翻页保留消息顺序、游标和预览条件', async () => {
  const calls: API.ChatHistoryAppQueryRequest[] = []
  const data = [
    [{ id: '3', createTime: '2026-10-12T10:03:00', messageType: 'ai', message: '回复' },
      { id: '2', createTime: '2026-10-12T10:02:00', messageType: 'user', message: '提问' }],
    [{ id: '1', createTime: '2026-10-12T10:01:00', messageType: 'user', message: '开始' }],
  ]
  Object.assign(globalThis, {
    __mockHistory: async (query: API.ChatHistoryAppQueryRequest) => {
      calls.push(query)
      return { data: { code: 0, data: { records: data[calls.length - 1], totalRow: calls.length === 1 ? 3 : 1 } } }
    },
  })
  const messages = ref<import('../src/utils/chatHistory.ts').ChatMessage[]>([])
  let previews = 0
  const history = useAppHistory({
    app: app(), canReadHistory: ref(true), messages, messageList: ref(null),
    showPreview: async () => { previews += 1 }, scrollToBottom: async () => undefined,
    getVersion: () => 1,
  })
  assert.equal(await history.loadHistory(), true)
  assert.equal(history.hasMoreHistory.value, true)
  assert.equal(history.historyLoaded.value, true)
  assert.equal(previews, 1)
  assert.deepEqual(messages.value.map(item => item.content), ['提问', '回复'])

  assert.equal(await history.loadHistory(true), true)
  assert.equal(String(calls[1].lastId), '2')
  assert.equal(calls[1].lastCreateTime, '2026-10-12T10:02:00')
  assert.deepEqual(messages.value.map(item => item.content), ['开始', '提问', '回复'])
  assert.equal(history.hasMoreHistory.value, false)
})
