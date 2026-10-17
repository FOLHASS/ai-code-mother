import { readFileSync } from 'node:fs'
import { createPreviewGateway } from './previewGateway.ts'

const origin = process.env.PREVIEW_APP_ORIGIN
const upstream = process.env.PREVIEW_UPSTREAM || 'http://localhost:8123'
if (!origin) throw new Error('PREVIEW_APP_ORIGIN must specify the application origin')
const app = new URL(origin)
if (app.origin !== origin || !['http:', 'https:'].includes(app.protocol))
  throw new Error('PREVIEW_APP_ORIGIN must be an HTTP(S) origin')
const gateway = createPreviewGateway({
  upstream,
  allowedOrigins: new Set([origin]),
  bridgeSource: readFileSync(new URL('../dist/preview-editor-bridge.js', import.meta.url), 'utf8'),
})
const port = Number(process.env.PREVIEW_PORT || 5174)
gateway.listen(port, process.env.PREVIEW_HOST || '127.0.0.1', () => {
  console.log(`Preview gateway listening on port ${port}`)
})
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => gateway.close())
