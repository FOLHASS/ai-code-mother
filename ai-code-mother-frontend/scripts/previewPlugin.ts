import { loadEnv, type Plugin, type ViteDevServer } from 'vite'
import { createPreviewGateway } from './previewGateway.ts'
import { compilePreviewRuntime } from './previewRuntime.ts'

/** 为所有 Vite 启动入口启动隔离的预览服务。 */
export function previewGatewayPlugin(): Plugin {
  let port = 5174
  let upstream = 'http://localhost:8123'
  let appOrigin = ''
  let devServer: ViteDevServer | undefined
  let gateway: ReturnType<typeof createPreviewGateway> | undefined

  return {
    name: 'generated-website-preview',
    apply: 'serve',
    config(config, { mode }) {
      const env = {
        ...loadEnv(mode, config.envDir || config.root || process.cwd(), ''),
        ...process.env,
      }
      port = Number(env.PREVIEW_PORT || env.VITE_PREVIEW_PORT || 5174)
      if (!Number.isInteger(port) || port < 1 || port > 65535)
        throw new Error('PREVIEW_PORT must be a valid TCP port')
      upstream = env.PREVIEW_UPSTREAM || upstream
      appOrigin = env.PREVIEW_APP_ORIGIN || ''
      return { define: { 'import.meta.env.VITE_PREVIEW_PORT': JSON.stringify(String(port)) } }
    },
    configureServer(server) {
      devServer = server
    },
    async buildStart() {
      if (gateway?.listening) return
      const server = devServer
      const httpServer = server?.httpServer
      if (!server || !httpServer)
        throw new Error('Generated website preview requires an HTTP server')
      const allowedOrigins = new Set<string>()
      if (appOrigin) allowedOrigins.add(new URL(appOrigin).origin)
      const current = createPreviewGateway({
        upstream,
        allowedOrigins,
        bridgeSource: compilePreviewRuntime(),
      })
      gateway = current
      httpServer.once('listening', () => {
        const address = httpServer.address()
        if (!address || typeof address === 'string') return
        const protocol = server.config.server.https ? 'https' : 'http'
        const hosts = new Set(['localhost', '127.0.0.1'])
        const host = server.config.server.host
        if (typeof host === 'string' && !['0.0.0.0', '::'].includes(host)) hosts.add(host)
        for (const hostname of hosts)
          allowedOrigins.add(
            `${protocol}://${hostname.includes(':') ? `[${hostname}]` : hostname}:${address.port}`,
          )
        server.config.logger.info(`  Preview gateway: http://127.0.0.1:${port}`)
      })
      // buildStart runs after Vite closes the previous server on config reload,
      // and before it selects an HTTP port. This also reserves the preview port.
      await new Promise<void>((resolve, reject) => {
        current.once('error', reject)
        current.listen(port, '127.0.0.1', () => {
          current.off('error', reject)
          resolve()
        })
      })
    },
    async closeBundle() {
      if (!gateway) return
      const current = gateway
      gateway = undefined
      await new Promise<void>((resolve) => {
        current.close(() => resolve())
        current.closeAllConnections()
      })
    },
  }
}
