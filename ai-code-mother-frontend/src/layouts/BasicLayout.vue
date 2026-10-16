<script setup lang="ts">
/**
 * 普通业务路由的布局层：决定站点导航、页面留白与对话工作区的呈现方式。
 * 菜单定义与权限展示集中在这里，GlobalHeader 接收菜单并回传选择事件。
 * 模板通过 RouterView 放入业务页面，页面本身无需重复实现全局外壳。
 */
import { computed } from 'vue'
import { Layout } from 'ant-design-vue'
import type { MenuProps } from 'ant-design-vue'
import { useRoute, useRouter } from 'vue-router'

import GlobalHeader from '@/components/GlobalHeader.vue'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

const router = useRouter()
const route = useRoute()
const loginUserStore = useLoginUserStore()
// 对话页需要最大化聊天/网站预览空间，因此隐藏全局导航并移除常规页面留白。
const showGlobalChrome = computed(() => route.name !== 'AppChatPage')

// Add or remove entries here to configure the global navigation menu.
// 使用 computed 使登录用户角色更新后菜单立即同步；隐藏入口不替代服务端权限校验。
const menuItems = computed<MenuProps['items']>(() => [
  { key: '/', label: '首页' },
  ...(loginUserStore.loginUser.userRole === 'admin'
    ? [
        { key: '/admin/appManage', label: '应用管理' },
        { key: '/admin/chatHistoryManage', label: '对话管理' },
        { key: '/admin/userManage', label: '用户管理' },
      ]
    : []),
])

/** 菜单 key 就是目标路径；此处只触发路由跳转，不携带额外业务状态。 */
const handleMenuSelect = (key: string) => {
  void router.push(key)
}
</script>

<template>
  <Layout class="basic-layout">
    <GlobalHeader v-if="showGlobalChrome" :menu-items="menuItems" @select="handleMenuSelect" />

    <Layout.Content class="basic-content">
      <main class="content-container" :class="{ 'workspace-container': !showGlobalChrome }">
        <RouterView />
      </main>
    </Layout.Content>

  </Layout>
</template>

<style scoped>
/* 全局根尺寸由布局提供，scoped 规则中的 global 避免给 html/body 错加组件作用域属性。 */
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

.basic-layout {
  min-height: 100vh;
  background: #f7faff;
}

.basic-content {
  /* 内容区占据外壳的可用空间，实际业务布局继续由路由页面控制。 */
  flex: 1 1 auto;
  width: 100%;
}

.content-container {
  width: 100%;
  min-height: 320px;
  padding: 42px 0 64px;
}

.content-container > :deep(*) {
  /* RouterView 渲染出来的页面节点位于子组件内部，用 deep 统一其内容宽度。 */
  width: 100%;
}

.workspace-container {
  /* 对话页拥有自己的视口布局和内边距，此处不叠加常规页面的上下留白。 */
  width: 100%;
  padding: 0;
}

@media (max-width: 768px) {
  /* 普通页面在移动端缩小外层留白，保留足够的业务内容空间。 */
  .content-container {
    padding: 28px 0 48px;
  }
}
</style>
