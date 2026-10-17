import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { createContext, Script } from 'node:vm'
import { ref } from 'vue'
import { mapApp, mapHistory, mapPage } from '../src/shared/api/mappers.ts'
import { AppChatSessionController } from '../src/features/app-workbench/services/AppChatSessionController.ts'
import { VisualEditorController } from '../src/features/preview-editor/services/VisualEditorController.ts'
import { PreviewRepositoryService } from '../src/features/preview-editor/services/PreviewRepositoryService.ts'
import { PreviewService } from '../src/features/preview-editor/services/PreviewService.ts'
import { compilePreviewRuntime } from '../scripts/previewRuntime.ts'

const result = (data) => ({ data: { code: 0, data } })
const id = '9007199254740993123'
const ownerId = '9007199254740993124'
const app = mapApp({
  id,
  userId: ownerId,
  initPrompt: '创建一个个人网站',
  codeGenType: 'vue_project',
})
const notify = { success() {}, warning() {}, error() {} }

test('wire pagination strings become numbers while entity IDs remain exact strings', () => {
  const page = mapPage(
    {
      records: [{ id, userId: ownerId }],
      totalRow: '7',
      pageNumber: '1',
      pageSize: '6',
      totalPage: '2',
    },
    mapApp,
  )
  assert.deepEqual([page.totalRow, page.pageNumber, page.pageSize, page.totalPage], [7, 1, 6, 2])
  assert.equal(page.records[0].id, id)
  assert.equal(page.records[0].userId, ownerId)
  assert.equal(mapPage({ totalRow: '0' }, mapApp).totalRow, 0)
})

test('invalid pagination values cannot enter state or silently lose precision', () => {
  for (const totalRow of ['bad', '', '1.5', '-1', '9007199254740993', Infinity, -1])
    assert.throws(() => mapPage({ totalRow }, mapApp), /分页字段/)
})

function sessionWith(stream, history = { totalRow: '0', records: [] }) {
  let previews = 0
  const editor = new VisualEditorController(notify, () => ({
    disableEditMode() {},
    enableEditMode() {
      return false
    },
    destroy() {},
    clearSelection() {},
  }))
  const controller = new AppChatSessionController({
    route: { params: { id }, query: {}, path: '/app/' + id },
    page: {
      session: { loginUser: { id: ownerId, userRole: 'user' }, async fetchLoginUser() {} },
      router: { async push() {}, async replace() {}, back() {} },
      notify,
      confirm() {},
    },
    apps: {
      async getVoById() {
        return result(app)
      },
    },
    history: {
      async listApp() {
        return result(mapPage(history, mapHistory))
      },
    },
    stream: { stream },
    editor,
    async saveArchive() {},
    openUrl() {},
    preview: {
      getUrl: () => 'http://127.0.0.1:5174/api/static/vue_project_' + id + '/',
      async checkReady(url) {
        previews++
        return { url, ok: true, status: 200 }
      },
    },
  })
  return { controller, previews: () => previews }
}

test('string zero history sends the initial prompt, shows messages immediately and refreshes preview', async () => {
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  let requests = 0
  const { controller, previews } = sessionWith(async function* (params) {
    requests++
    assert.equal(params.appId, id)
    assert.equal(params.message, app.initPrompt)
    yield { type: 'ai_response', content: '已生成' }
    await gate
    yield { type: 'ai_response', content: '个人网站' }
  })
  try {
    const started = controller.start()
    await setImmediate()
    assert.equal(requests, 1)
    assert.equal(controller.messages.value[0].content, app.initPrompt)
    assert.equal(controller.messages.value[0].role, 'user')
    assert.equal(controller.isStreaming.value, true)
    release()
    await started
    await setImmediate()
    assert.equal(controller.messages.value[1].content, '已生成个人网站')
    assert.equal(controller.isStreaming.value, false)
    assert.equal(controller.hasGeneratedWebsite.value, true)
    assert.equal(previews(), 1)
  } finally {
    release()
    controller.dispose()
  }
})

test('existing string-count history is displayed and not generated again; follow-up appears immediately', async () => {
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  let requests = 0
  const { controller } = sessionWith(
    async function* () {
      requests++
      await gate
      yield { type: 'ai_response', content: '已调整' }
    },
    {
      totalRow: '2',
      records: [
        { id: '12', messageType: 'ai', message: '生成完成', createTime: '2026-10-17T10:00:01' },
        {
          id: '11',
          messageType: 'user',
          message: app.initPrompt,
          createTime: '2026-10-17T10:00:00',
        },
      ],
    },
  )
  try {
    await controller.start()
    assert.equal(requests, 0)
    assert.deepEqual(
      controller.messages.value.map((message) => message.content),
      [app.initPrompt, '生成完成'],
    )
    controller.input.value = '改成蓝色'
    const sent = controller.sendMessage()
    assert.equal(controller.messages.value[2].content, '改成蓝色')
    assert.equal(controller.input.value, '')
    release()
    await sent
    assert.equal(controller.messages.value[3].content, '已调整')
  } finally {
    release()
    controller.dispose()
  }
})

test('generation errors retain the prompt and show the failure in the message list', async () => {
  const { controller } = sessionWith(async function* () {
    yield await Promise.reject(new Error('上游握手失败'))
  })
  try {
    await controller.start()
    assert.equal(controller.messages.value[0].content, app.initPrompt)
    assert.match(controller.messages.value[1].content, /上游握手失败/)
    assert.equal(controller.messages.value[1].error, true)
    assert.equal(controller.isStreaming.value, false)
  } finally {
    controller.dispose()
  }
})

test('Vue previews prefer published root and fall back to legacy dist only on 404', async () => {
  const urls = []
  const repository = new PreviewRepositoryService(async (url, options) => {
    assert.equal(options.credentials, 'omit')
    assert.equal(options.method, 'HEAD')
    urls.push(String(url))
    return new Response(null, { status: urls.length === 1 ? 404 : 200 })
  })
  const result = await repository.checkReady(
    'http://127.0.0.1:5174/api/static/vue_project_' + id + '/?t=123',
  )
  assert.equal(result.ok, true)
  assert.match(result.url, /\/dist\/index.html\?t=123$/)
  assert.equal(urls.length, 2)
  urls.length = 0
  const preview = new PreviewService(ref(app), () => 1, {
    getUrl: () => 'http://127.0.0.1:5174/api/static/vue_project_' + id + '/?t=123',
    checkReady: (url, signal) => repository.checkReady(url, signal),
  })
  await preview.show()
  assert.match(preview.previewUrl.value, /\/dist\/index.html\?t=123$/)
  assert.equal(preview.hasGeneratedWebsite.value, true)
  for (const status of [200, 403, 500]) {
    let count = 0
    const root = new PreviewRepositoryService(async () => {
      count++
      return new Response(null, { status })
    })
    await root.checkReady('http://127.0.0.1:5174/api/static/vue_project_' + id + '/')
    assert.equal(count, 1)
  }
})

test('preview editor compiles into a standalone classic browser script', () => {
  const source = compilePreviewRuntime()
  assert.doesNotThrow(() => new Script(source))
  assert.match(source, /ai-code-mother-visual-editor/)
  const listeners = []
  const context = createContext({
    document: { currentScript: { dataset: { appOrigins: 'http://localhost:5173' } } },
    window: { addEventListener: (event) => listeners.push(event) },
  })
  new Script('const source = "generated-website"; const origins = [];').runInContext(context)
  new Script(source).runInContext(context)
  assert.deepEqual(listeners, ['message', 'pagehide'])
})
