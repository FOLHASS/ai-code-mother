<script setup lang="ts">
import { Layout } from 'ant-design-vue'
import type { MenuProps } from 'ant-design-vue'
import { useRouter } from 'vue-router'

import GlobalFooter from '@/components/GlobalFooter.vue'
import GlobalHeader from '@/components/GlobalHeader.vue'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

const router = useRouter()
const loginUserStore = useLoginUserStore()

// Add or remove entries here to configure the global navigation menu.
const menuItems: MenuProps['items'] = [
  { key: '/', label: '首页' },
  ...(loginUserStore.loginUser.userRole === 'admin'
    ? [{ key: '/admin/userManage', label: '用户管理' }]
    : []),
]

const handleMenuSelect = (key: string) => {
  void router.push(key)
}
</script>

<template>
  <Layout class="basic-layout">
    <GlobalHeader :menu-items="menuItems" @select="handleMenuSelect" />

    <Layout.Content class="basic-content">
      <main class="content-container">
        <RouterView />
      </main>
    </Layout.Content>

    <GlobalFooter />
  </Layout>
</template>

<style scoped>
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
  flex: 1 1 auto;
  width: 100%;
}

.content-container {
  width: min(1280px, calc(100% - 56px));
  min-height: 320px;
  margin: 0 auto;
  padding: 42px 0 64px;
}

@media (max-width: 768px) {
  .content-container {
    width: min(100% - 32px, 1280px);
    padding: 28px 0 48px;
  }
}
</style>
