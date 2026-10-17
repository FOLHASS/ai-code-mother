import { createServer } from 'node:http'

export type PreviewGatewayOptions = {
  upstream: string
  allowedOrigins: Set<string>
  bridgeSource: string
}

const MAX_STATIC_BYTES = 20 * 1024 * 1024

/** 判断两个地址是否属于同一来源。 */
function isSameOrigin(origin: string, host: string | undefined): boolean {
  try {
    const url = new URL(origin)
    return ['http:', 'https:'].includes(url.protocol) && url.origin === origin && url.host === host
  } catch {
    return false
  }
}

/** 读取静态预览资源响应内容。 */
async function readStaticBody(result: Response): Promise<Uint8Array> {
  if (Number(result.headers.get('content-length') || 0) > MAX_STATIC_BYTES)
    throw new Error('Static file too large')
  const reader = result.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_STATIC_BYTES) throw new Error('Static file too large')
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
  return Buffer.concat(chunks, size)
}

/** 创建开发环境的预览资源代理。 */
export function createPreviewGateway(options: PreviewGatewayOptions) {
  const upstream = new URL(options.upstream)
  if (!['http:', 'https:'].includes(upstream.protocol)) throw new Error('Invalid preview upstream')
  return createServer(async (request, response) => {
    const origin = request.headers.origin
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    response.setHeader(
      'Content-Security-Policy',
      `frame-ancestors ${[...options.allowedOrigins].join(' ')}; object-src 'none'; base-uri 'self'`,
    )
    if (origin) {
      // Module scripts and crossorigin assets send the preview's own Origin.
      if (!options.allowedOrigins.has(origin) && !isSameOrigin(origin, request.headers.host)) {
        response.writeHead(403).end()
        return
      }
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Vary', 'Origin')
    }
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
      response.writeHead(204).end()
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end()
      return
    }
    try {
      const url = new URL(request.url || '/', 'http://preview.invalid')
      if (url.pathname === '/__preview_bridge__.js') {
        response.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        response.writeHead(200).end(request.method === 'HEAD' ? undefined : options.bridgeSource)
        return
      }
      const decoded = decodeURIComponent(url.pathname)
      if (
        !decoded.startsWith('/api/static/') ||
        decoded.includes('\\') ||
        /%2e|%2f|%5c/i.test(decoded) ||
        decoded.split('/').some((part) => part === '..' || part === '.')
      ) {
        response.writeHead(404).end()
        return
      }
      // Only the static path is reachable. Never forward browser Cookie/Authorization headers.
      const result = await fetch(new URL(url.pathname + url.search, upstream), {
        method: request.method,
        headers: { 'Accept-Encoding': 'identity' },
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
      })
      if (result.status >= 300 && result.status < 400) {
        response.writeHead(502).end('Preview redirects are not allowed')
        return
      }
      const contentType = result.headers.get('content-type') || 'application/octet-stream'
      response.setHeader('Content-Type', contentType)
      if (request.method === 'HEAD') {
        response.writeHead(result.status).end()
        return
      }
      if (contentType.includes('text/html') && result.ok) {
        const html = new TextDecoder().decode(await readStaticBody(result))
        if (html.length > 5_000_000) {
          response.writeHead(413).end()
          return
        }
        const directory = url.pathname.endsWith('/')
          ? url.pathname
          : url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1)
        const rewritten = html.replace(
          /\b(src|href)=(['"])\/(?!\/|api\/static\/)([^'"]*)\2/gi,
          (_match, attr: string, quote: string, path: string) =>
            `${attr}=${quote}${directory}${path}${quote}`,
        )
        const origins = [...options.allowedOrigins]
          .join(',')
          .replaceAll('&', '&amp;')
          .replaceAll('"', '&quot;')
        const bridge = `<script defer src="/__preview_bridge__.js" data-app-origins="${origins}"></script>`
        const document = /<head(?:\s[^>]*)?>/i.test(rewritten)
          ? rewritten.replace(/<head(?:\s[^>]*)?>/i, (match) => match + bridge)
          : bridge + rewritten
        response.writeHead(result.status).end(document)
        return
      }
      // Buffer only one static response; large archives are never served by this gateway.
      const body = await readStaticBody(result)
      response.writeHead(result.status).end(Buffer.from(body))
    } catch {
      if (!response.headersSent) response.writeHead(502)
      response.end('Preview upstream unavailable')
    }
  })
}
