import test from 'node:test'
import assert from 'node:assert/strict'

import {
  adaptChatStreamPayload,
  parseChatSseEvent,
} from '../src/modules/ai-chat/services/chatProtocolAdapter.ts'

test('adapts raw text and nested d payloads to AI response events', () => {
  assert.deepEqual(adaptChatStreamPayload('hello'), { type: 'ai_response', content: 'hello' })
  assert.deepEqual(adaptChatStreamPayload({ d: '{"type":"ai_response","data":"你好"}' }), {
    type: 'ai_response',
    content: '你好',
  })
})

test('adapts thinking and tool request aliases without leaking backend fields', () => {
  assert.deepEqual(adaptChatStreamPayload({ type: 'thinking', data: 'planning' }), {
    type: 'thinking',
    content: 'planning',
  })
  assert.deepEqual(
    adaptChatStreamPayload({
      type: 'tool_request',
      id: 12,
      name: 'write_file',
      arguments: { path: 'index.html' },
    }),
    {
      type: 'tool_request',
      toolId: '12',
      toolName: 'write_file',
      toolArguments: '{"path":"index.html"}',
    },
  )
})

test('adapts tool execution result and preserves a displayable content field', () => {
  assert.deepEqual(
    adaptChatStreamPayload({ type: 'tool_executed', id: 't1', name: 'write_file', result: 'ok' }),
    {
      type: 'tool_executed',
      toolId: 't1',
      toolName: 'write_file',
      result: 'ok',
      content: 'ok',
    },
  )
})

test('ignores unsupported payloads and keeps primitive data values readable', () => {
  assert.equal(adaptChatStreamPayload({ type: 'unknown', nested: true }), null)
  assert.deepEqual(adaptChatStreamPayload({ data: 42 }), { type: 'ai_response', content: '42' })
  assert.equal(adaptChatStreamPayload(null), null)
})

test('parses CRLF and multi-line SSE frames without leaking protocol markers', () => {
  assert.deepEqual(
    parseChatSseEvent('event: message\r\ndata: {"type":"ai_response",\r\ndata: "data":"ok"}\r\n'),
    { type: 'ai_response', content: 'ok' },
  )
  assert.deepEqual(parseChatSseEvent('event: done\ndata:\n'), { done: true })
  assert.deepEqual(parseChatSseEvent('data: [DONE]'), { done: true })
})

test('turns explicit SSE errors into typed failures', () => {
  assert.throws(() => parseChatSseEvent('event: error\ndata: {"message":"登录已过期"}'), /登录已过期/)
})

