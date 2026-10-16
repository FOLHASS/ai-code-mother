import test from 'node:test'
import assert from 'node:assert/strict'

import { mergeHistoryMessages, sortHistoryRecords } from '../src/modules/ai-chat/services/chatHistoryMapper.ts'

const record = (overrides: Record<string, unknown> = {}) => ({
  id: '1',
  createTime: '2026-01-01T00:00:00.000Z',
  messageType: 'user',
  message: 'hello',
  ...overrides,
}) as API.ChatHistoryVO

test('sortHistoryRecords orders by time then full precision ID without mutating input', () => {
  const input = [
    record({ id: '90071992547409932', createTime: '2026-01-01T00:00:01.000Z' }),
    record({ id: '90071992547409931', createTime: '2026-01-01T00:00:00.000Z' }),
    record({ id: '90071992547409930', createTime: '2026-01-01T00:00:00.000Z' }),
  ]
  const sorted = sortHistoryRecords(input)

  assert.deepEqual(sorted.map((item) => String(item.id)), [
    '90071992547409930',
    '90071992547409931',
    '90071992547409932',
  ])
  assert.equal(input[0]?.id, '90071992547409932')
})

test('mergeHistoryMessages prepends unique persisted rows and preserves live rows', () => {
  const current = [
    { id: 'live-1', role: 'assistant', content: 'live answer' },
    { id: 'history-2', historyId: '2', role: 'user', content: 'already loaded' },
  ] satisfies import('../src/modules/ai-chat/types/chatMessage.ts').ChatMessage[]
  const merged = mergeHistoryMessages(current, [
    record({ id: '3', messageType: 'ai', message: 'older answer' }),
    record({ id: '2', messageType: 'user', message: 'duplicate' }),
    record({ id: '3', messageType: 'ai', message: 'duplicate in page' }),
    record({ id: undefined, message: 'missing id' }),
  ])

  assert.deepEqual(merged.map((item) => item.historyId || item.id), ['3', 'live-1', '2'])
  assert.equal(merged[0]?.role, 'assistant')
  assert.equal(merged[0]?.content, 'older answer')
})

test('mergeHistoryMessages restores persisted generation failure state only for AI rows', () => {
  const merged = mergeHistoryMessages([], [
    record({ id: '10', messageType: 'ai', message: '[生成失败] 网络异常' }),
    record({ id: '11', messageType: 'user', message: '[生成失败] user text' }),
  ])

  assert.equal(merged[0]?.error, true)
  assert.equal(merged[1]?.error, false)
})

