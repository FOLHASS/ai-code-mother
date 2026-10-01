<script setup lang="ts">
import { computed } from 'vue'
import { Menu, Button } from 'ant-design-vue'
import type { MenuProps } from 'ant-design-vue'
import { useRoute } from 'vue-router'

import logoUrl from '@/assets/logo.png'

defineProps<{
  menuItems: MenuProps['items']
}>()

const emit = defineEmits<{
  select: [key: string]
}>()

const route = useRoute()
const selectedKeys = computed(() => [route.path])

const handleMenuClick = ({ key }: { key: string | number }) => {
  if (typeof key === 'string') {
    emit('select', key)
  }
}
</script>

<template>
  <header class="global-header">
    <div class="header-inner">
      <RouterLink class="brand" to="/" aria-label="返回首页">
        <img class="brand-logo" :src="logoUrl" alt="零代码应用生成平台 logo" />
        <span class="brand-title">AI 零代码应用生成平台</span>
      </RouterLink>

      <Menu
        class="global-menu"
        mode="horizontal"
        theme="light"
        :items="menuItems"
        :selected-keys="selectedKeys"
        @click="handleMenuClick"
      />

      <Button class="login-button" type="primary" ghost>登录</Button>
    </div>
  </header>
</template>

<style scoped>
.global-header {
  flex: 0 0 auto;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 64px;
  max-width: 1200px;
  margin: 0 auto;
}

.brand {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  color: #1f1f1f;
  text-decoration: none;
  white-space: nowrap;
}

.brand-logo {
  width: 36px;
  height: 36px;
  object-fit: contain;
  border-radius: 8px;
}

.brand-title {
  font-size: 18px;
  font-weight: 600;
}

.global-menu {
  flex: 1 1 auto;
  min-width: 0;
  background: #fff;
  border-bottom: 0;
}

.global-menu :deep(.ant-menu-item),
.global-menu :deep(.ant-menu-item-selected),
.global-menu :deep(.ant-menu-item:hover) {
  background: transparent;
}

.global-menu :deep(.ant-menu-overflow) {
  justify-content: flex-start;
}

.login-button {
  flex: 0 0 auto;
}

@media (max-width: 768px) {
  .global-header {
    padding: 0 16px;
  }

  .header-inner {
    gap: 10px;
  }

  .brand-title {
    font-size: 16px;
  }

  .global-menu {
    overflow-x: auto;
  }
}

@media (max-width: 480px) {
  .header-inner {
    flex-wrap: wrap;
    padding: 10px 0;
  }

  .global-menu {
    order: 3;
    flex-basis: 100%;
  }
}
</style>
