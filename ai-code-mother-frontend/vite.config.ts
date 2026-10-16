/**
 * Vite 开发与构建配置，在 Node 环境执行，不属于浏览器业务配置模块。
 * Vue 插件编译单文件组件，DevTools 插件辅助开发；具体页面 API 地址在 src/config/env.ts 定义。
 */
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  // 两个插件分别提供 Vue 单文件组件编译能力与开发调试面板。
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      // 通过当前配置文件的 URL 计算绝对路径，避免依赖启动命令所在目录。
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // 只在开发服务器生效：浏览器访问本站 /api，由代理转发到后端，预览 iframe 也可保持同源。
      '/api': {
        // 不配置 rewrite，因此 /api 路径前缀会保留并匹配后端的 context-path。
        target: 'http://localhost:8123',
        // 代理请求采用目标站点的 Host；浏览器看到的请求地址仍是前端开发服务器。
        changeOrigin: true,
        // 此选项影响 HTTPS 代理目标的证书校验，当前 HTTP 目标不使用 TLS。
        secure: false,
      },
    },
  },
})
