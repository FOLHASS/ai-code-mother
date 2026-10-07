import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mergeHistoryMessages, sortHistoryRecords } from '../src/utils/chatHistory.ts'
import type { ChatMessage } from '../src/utils/chatHistory.ts'

const record = (id: string, createTime = '2026-10-07T00:00:00', messageType = 'user', message = id) => ({
  id, createTime, messageType, message,
})

test('历史按时间升序，同秒雪花 ID 超出安全整数范围时仍保持顺序', () => {
  const records = [record('9007199254740995'), record('9007199254740994'), record('9007199254740993', '2026-10-06T23:59:59')]
  assert.deepEqual(sortHistoryRecords(records).map(item => item.id), ['9007199254740993', '9007199254740994', '9007199254740995'])
  assert.equal(records[0].id, '9007199254740995')
})

test('用户、AI 和失败消息恢复为对应角色，且不会把消息 ID 转成 Number', () => {
  const messages = mergeHistoryMessages([], [record('9007199254740994', undefined, 'ai', '[生成失败] 模型连接失败'), record('9007199254740993')])
  assert.deepEqual(messages.map(item => item.role), ['user', 'assistant'])
  assert.equal(messages[1].historyId, '9007199254740994')
  assert.equal(messages[1].error, true)
})

test('向前加载累积消息、过滤重叠记录，保留正在进行的对话', () => {
  const current: ChatMessage[] = [
    ...mergeHistoryMessages([], [record('12'), record('11')]),
    { id: 'live-1', role: 'user', content: '继续生成' },
    { id: 'live-2', role: 'assistant', content: '流式回复', loading: true },
  ]
  const merged = mergeHistoryMessages(current, [record('11'), record('10'), record('9'), record('9')])
  assert.deepEqual(merged.map(item => item.id), ['history-9', 'history-10', 'history-11', 'history-12', 'live-1', 'live-2'])
  assert.equal(merged.at(-1)?.loading, true)
  assert.equal(current.length, 4)
})
