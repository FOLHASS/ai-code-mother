<script setup lang="ts">
import { Layout } from 'ant-design-vue'
import type { MenuProps } from 'ant-design-vue'
import { useRouter } from 'vue-router'

import GlobalFooter from '@/components/GlobalFooter.vue'
import GlobalHeader from '@/components/GlobalHeader.vue'

const router = useRouter()

// Add or remove entries here to configure the global navigation menu.
const menuItems: MenuProps['items'] = [
  { key: '/', label: '首页' },
  { key: '/algorithm', label: '算法' },
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
  background: #f5f5f5;
}

.basic-layout {
  min-height: 100vh;
  background: #f5f5f5;
}

.basic-content {
  flex: 1 1 auto;
  width: 100%;
}

.content-container {
  width: min(1200px, calc(100% - 48px));
  min-height: 240px;
  margin: 0 auto;
  padding: 32px 0;
}

@media (max-width: 768px) {
  .content-container {
    width: min(100% - 32px, 1200px);
    padding: 24px 0;
  }
}
</style>
