<script setup lang="ts">
/**
 * 认证路由使用的独立布局，只承接登录/注册页面，不渲染普通页面的导航菜单。
 * 页面内部的品牌说明与表单样式由 AuthPageShell 和具体认证页面负责。
 */
import { Layout } from 'ant-design-vue'
import SessionStatusNotice from './components/SessionStatusNotice.vue'
</script>

<template>
  <Layout class="auth-layout">
    <SessionStatusNotice />
    <RouterView />
  </Layout>
</template>

<style scoped>
/* 根节点的基础尺寸需要使用 global，避免 scoped 选择器只能作用于当前组件节点。 */
:global(html),
:global(body),
:global(#app) {
  min-width: 320px;
  min-height: 100%;
  margin: 0;
}

:global(body) {
  background: #f7faff;
}

.auth-layout {
  /* 认证页至少覆盖整个视口高度，表单内容更高时仍能自然扩展。 */
  min-height: 100vh;
  background: #f7faff;
}
</style>
