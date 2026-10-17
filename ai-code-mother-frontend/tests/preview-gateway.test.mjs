import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'
import { previewGatewayPlugin } from '../scripts/previewPlugin.ts'

async function listen(server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return server.address().port
}
async function close(server) {
  await new Promise((resolve) => {
    server.close(resolve)
    server.closeAllConnections()
  })
}

test(
  'direct Vite startup serves isolated previews on the actual app port and survives restart',
  { timeout: 15000 },
  async () => {
    const upstreamRequests = []
    const upstream = createHttpServer((request, response) => {
      upstreamRequests.push({
        url: request.url,
        cookie: request.headers.cookie,
        auth: request.headers.authorization,
      })
      if (request.url === '/api/static/vue_project_123/?t=123') {
        response.writeHead(404).end()
      } else if (request.url === '/api/static/vue_project_123/dist/index.html?t=123') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end(
          '<html><head></head><body><script src="/assets/index.js"></script></body></html>',
        )
      } else if (request.url === '/api/static/vue_project_123/dist/assets/index.js') {
        response
          .writeHead(200, { 'Content-Type': 'application/javascript' })
          .end('console.log("ready")')
      } else response.writeHead(404).end()
    })
    // Occupy Vite's requested port to exercise its automatic port fallback.
    const occupied = createHttpServer()
    const previewReservation = createHttpServer()
    const originalEnv = {
      PREVIEW_PORT: process.env.PREVIEW_PORT,
      PREVIEW_UPSTREAM: process.env.PREVIEW_UPSTREAM,
    }
    let vite
    try {
      const upstreamPort = await listen(upstream)
      const requestedAppPort = await listen(occupied)
      const previewPort = await listen(previewReservation)
      await close(previewReservation)
      process.env.PREVIEW_PORT = String(previewPort)
      process.env.PREVIEW_UPSTREAM = `http://127.0.0.1:${upstreamPort}`
      vite = await createViteServer({
        configFile: false,
        root: fileURLToPath(new URL('..', import.meta.url)),
        plugins: [previewGatewayPlugin()],
        logLevel: 'silent',
        server: { host: '127.0.0.1', port: requestedAppPort, hmr: false, watch: null },
        optimizeDeps: { noDiscovery: true, include: [] },
      })
      await vite.listen()
      const origin = `http://localhost:${vite.httpServer.address().port}`
      assert.notEqual(vite.httpServer.address().port, requestedAppPort)
      const previewBase = `http://127.0.0.1:${previewPort}`
      const headers = { Origin: origin, Cookie: 'session=private', Authorization: 'Bearer private' }
      const entry = previewBase + '/api/static/vue_project_123/dist/index.html?t=123'
      const html = await fetch(entry, { headers })
      assert.equal(html.status, 200)
      assert.equal(html.headers.get('access-control-allow-origin'), origin)
      assert.ok(html.headers.get('content-security-policy').includes(origin))
      const body = await html.text()
      assert.match(body, /src="\/__preview_bridge__\.js"/)
      assert.match(body, /src="\/api\/static\/vue_project_123\/dist\/assets\/index\.js"/)
      const script = await fetch(previewBase + '/api/static/vue_project_123/dist/assets/index.js', {
        headers: { ...headers, Origin: previewBase },
      })
      assert.equal(script.status, 200)
      await script.text()
      const blocked = await fetch(entry, {
        headers: { Origin: `http://localhost:${requestedAppPort}` },
      })
      assert.equal(blocked.status, 403)
      await blocked.text()
      const api = await fetch(previewBase + '/api/user/get/login', { headers })
      assert.equal(api.status, 404)
      await api.text()
      assert.equal(upstreamRequests.length, 2)
      assert.ok(upstreamRequests.every((request) => !request.cookie && !request.auth))
      await vite.restart()
      const afterRestart = await fetch(entry, {
        headers: { Origin: `http://localhost:${vite.httpServer.address().port}` },
      })
      assert.equal(afterRestart.status, 200)
      await afterRestart.text()
      await vite.close()
      vite = undefined
      await assert.rejects(fetch(entry))
    } finally {
      await vite?.close()
      await close(upstream)
      await close(occupied)
      await close(previewReservation)
      for (const [name, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
      }
    }
  },
)
