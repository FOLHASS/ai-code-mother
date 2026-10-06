<script setup lang="ts">
import { computed } from 'vue'
import { Avatar, Button, Dropdown, Menu } from 'ant-design-vue'
import type { MenuProps } from 'ant-design-vue'
import { useRoute, useRouter } from 'vue-router'

import logoUrl from '@/assets/logo.png'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'
import { logout } from '@/api/userController.ts'

defineProps<{
  menuItems: MenuProps['items']
}>()

const emit = defineEmits<{
  select: [key: string]
}>()

const loginUserStore = useLoginUserStore()
const router = useRouter()

const route = useRoute()
const selectedKeys = computed(() => [route.path])
const isLoggedIn = computed(() => Boolean(loginUserStore.loginUser.id))
const displayName = computed(
  () => loginUserStore.loginUser.userName || loginUserStore.loginUser.userAccount || '用户',
)

const userMenuItems: MenuProps['items'] = [
  { key: 'profile', label: '个人信息' },
  { type: 'divider' },
  { key: 'logout', label: '退出登录' },
]

const handleMenuClick = ({ key }: { key: string | number }) => {
  if (typeof key === 'string') {
    emit('select', key)
  }
}

const handleUserMenuClick = async ({ key }: { key: string | number }) => {
  if (key === 'profile') {
    await router.push('/user/profile')
    return
  }

  if (key === 'logout') {
    await logout()
    loginUserStore.setLoginUser({ userName: '未登录' })
    await router.push('/user/login')
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

      <div class="user-area">
        <Button
          v-if="!isLoggedIn"
          class="login-button"
          type="primary"
          ghost
          @click="router.push('/user/login')"
        >
          登录
        </Button>

        <Dropdown v-else placement="bottomRight" :trigger="['click']">
          <button class="user-trigger" type="button" aria-label="打开用户菜单">
            <Avatar :src="loginUserStore.loginUser.userAvatar" :size="32">
              {{ displayName.slice(0, 1).toUpperCase() }}
            </Avatar>
            <span class="user-name">{{ displayName }}</span>
          </button>

          <template #overlay>
            <Menu :items="userMenuItems" @click="handleUserMenuClick" />
          </template>
        </Dropdown>
      </div>
    </div>
  </header>
</template>

<style scoped>
.global-header {
  flex: 0 0 auto;
  padding: 0 28px;
  background: rgb(255 255 255 / 90%);
  border-bottom: 1px solid #eaf0f6;
  box-shadow: 0 4px 18px rgb(37 85 139 / 4%);
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: 68px;
  width: min(1280px, 100%);
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
  width: 38px;
  height: 38px;
  object-fit: contain;
  border-radius: 8px;
}

.brand-title {
  color: #1b3554;
  font-size: 17px;
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

.global-menu :deep(.ant-menu-item) {
  color: #6c7d91;
  font-size: 14px;
}

.global-menu :deep(.ant-menu-item-selected) {
  color: #2478d6;
  font-weight: 600;
}

.global-menu :deep(.ant-menu-item::after) {
  border-bottom-color: transparent;
}

.global-menu :deep(.ant-menu-item-selected::after) {
  border-bottom-color: #2478d6;
}

.global-menu :deep(.ant-menu-overflow) {
  justify-content: flex-start;
}

.user-area {
  flex: 0 0 auto;
}

.user-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 4px 8px;
  color: #1f1f1f;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.user-trigger:hover,
.user-trigger:focus-visible {
  background: #f1f7ff;
  outline: none;
}

.user-name {
  max-width: 140px;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
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

  .user-name {
    max-width: 96px;
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
