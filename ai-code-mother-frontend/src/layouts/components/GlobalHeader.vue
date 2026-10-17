<script setup lang="ts">
/**
 * 普通业务页面的全局导航：展示品牌、父布局提供的菜单，以及共享登录态对应的用户入口。
 * 页面路由跳转由组件/父布局分工处理：主菜单只向父级报告 key，个人资料和退出在本组件处理。
 * 模板中未登录用户显示登录按钮，已登录用户显示头像与点击展开的用户菜单。
 */
import { Avatar, Button, Dropdown, Menu } from 'ant-design-vue'
import type { MenuProps } from 'ant-design-vue'

import logoUrl from '@/assets/logo-display.png'
import { useGlobalHeaderController } from '@/app/controllers.ts'

defineProps<{
  /** 由 BasicLayout 根据用户角色生成；本组件只负责渲染，不重新计算管理入口权限。 */
  menuItems: MenuProps['items']
}>()

const emit = defineEmits<{
  /** 菜单 key 采用目标路由路径，父组件监听后执行导航。 */
  select: [key: string]
}>()

const controller = useGlobalHeaderController((key) => emit('select', key))
const {
  selectedKeys,
  isLoggedIn,
  displayName,
  avatarUrl,
  goToLogin,
  userMenuItems,
  handleMenuClick,
  handleUserMenuClick,
} = controller
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
        <Button v-if="!isLoggedIn" class="login-button" type="primary" ghost @click="goToLogin()">
          登录
        </Button>

        <Dropdown v-else placement="bottomRight" :trigger="['click']">
          <button class="user-trigger" type="button" aria-label="打开用户菜单">
            <Avatar :src="avatarUrl" :size="32">
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
/* 导航不参与内容区伸缩；浅色背景、分隔线和轻阴影让页面顶部保持独立层次。 */
.global-header {
  flex: 0 0 auto;
  padding: 0 28px;
  background: rgb(255 255 255 / 90%);
  border-bottom: 1px solid #eaf0f6;
  box-shadow: 0 4px 18px rgb(37 85 139 / 4%);
}

/* 内容居中且限制最大宽度，内部用 Flex 在品牌、可伸缩菜单和用户区之间分配空间。 */
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
  /* 菜单允许缩小；min-width: 0 防止菜单内容撑破整行布局。 */
  flex: 1 1 auto;
  min-width: 0;
  background: #fff;
  border-bottom: 0;
}

/* deep 仅用于定制组件库渲染的菜单内部节点，其余规则维持 scoped 作用域。 */
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
  /* 长用户名不挤压导航，以单行省略号展示。 */
  max-width: 140px;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  /* 平板宽度收紧左右留白与文字占位，同时允许菜单横向滚动。 */
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
  /* 手机宽度把主菜单放到下一行，保留品牌和用户入口的可点击空间。 */
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
