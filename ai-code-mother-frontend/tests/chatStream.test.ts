import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { afterEach, mock, test } from 'node:test'

// 流式工具的唯一应用依赖是 API 地址，测试时不加载浏览器请求拦截器。
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/request') {
      return { url: 'data:text/javascript,export const API_BASE_URL = "http://localhost:8123/api"', shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})
const { streamChatToGenCode } = await import('../src/utils/chatStream.ts')
hooks.deregister()
afterEach(() => mock.restoreAll())

const params = { appId: '9007199254740993', message: '创建网站' }
const response = (data: string) => {
  const bytes = new TextEncoder().encode(data)
  return new Response(new ReadableStream({
    start(controller) {
      // 每次仅发送一个字节，覆盖中文 UTF-8、JSON、空行跨网络片段的情况。
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
      controller.close()
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } })
}
const collect = async () => {
  const chunks: string[] = []
  for await (const chunk of streamChatToGenCode(params)) chunks.push(chunk)
  return chunks
}

test('跨网络片段读取 UTF-8 和多个 SSE 事件，等 done 后完成', async () => {
  mock.method(globalThis, 'fetch', async () => response('data:{"d":"你好"}\r\n\r\ndata:{"d":"世界"}\n\nevent:done\ndata:\n\n'))
  assert.deepEqual(await collect(), ['你好', '世界'])
})

test('失败事件保留此前片段，并向调用者抛出错误原因', async () => {
  mock.method(globalThis, 'fetch', async () => response('data:{"d":"部分回复"}\n\nevent:error\ndata:{"message":"模型连接失败"}\n\n'))
  const chunks: string[] = []
  await assert.rejects(async () => {
    for await (const chunk of streamChatToGenCode(params)) chunks.push(chunk)
  }, /模型连接失败/)
  assert.deepEqual(chunks, ['部分回复'])
})

test('连接结束却缺少 done 时不能被认为生成成功', async () => {
  mock.method(globalThis, 'fetch', async () => response('data:{"d":"未完成回复"}\n\n'))
  await assert.rejects(collect, /连接提前结束/)
})

test('正常 JSON 响应可以读取，业务错误不能吞掉', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ code: 0, data: '完整回复' }))
  assert.deepEqual(await collect(), ['完整回复'])
  mock.restoreAll()
  mock.method(globalThis, 'fetch', async () => Response.json({ code: 40101, message: '无权限' }))
  await assert.rejects(collect, /无权限/)
})

test('保留字符串应用 ID 和凭据，同时支持中断请求', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => response('event:done\ndata:\n\n'))
  const controller = new AbortController()
  for await (const chunk of streamChatToGenCode(params, controller.signal)) void chunk
  const [url, options] = fetchMock.mock.calls[0].arguments
  assert.equal(new URL(String(url)).searchParams.get('appId'), params.appId)
  assert.equal(options?.credentials, 'include')
  assert.equal(options?.signal, controller.signal)
})
