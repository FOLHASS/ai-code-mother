<script setup lang="ts">
import { computed } from 'vue'
import { Dropdown, Menu } from 'ant-design-vue'
import type { MenuProps } from 'ant-design-vue'

import { formatDate, getDeployUrl } from '@/utils/app.ts'
import AppCover from '@/components/AppCover.vue'
import UserAvatar from '@/components/UserAvatar.vue'

type AppCardVariant = 'workspace' | 'featured'

const props = withDefaults(
  defineProps<{
    app: API.AppVO
    variant?: AppCardVariant
    showActions?: boolean
  }>(),
  {
    variant: 'workspace',
    showActions: true,
  },
)

const authorName = computed(() => props.app.user?.userName?.trim()
  || props.app.user?.userAccount?.trim()
  || 'NoCode 创作者')

const emit = defineEmits<{
  open: [app: API.AppVO]
  edit: [app: API.AppVO]
  remove: [app: API.AppVO]
}>()

const handleMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
  domEvent.stopPropagation()
  if (key === 'edit') emit('edit', props.app)
  if (key === 'remove') emit('remove', props.app)
}
</script>

<template>
  <article
    class="app-card"
    :class="{ 'app-card--featured': props.variant === 'featured' }"
    @click="emit('open', props.app)"
  >
    <div class="app-card__cover">
      <AppCover :app="props.app" :featured="props.variant === 'featured'" />
      <div class="app-card__hover">
        <button type="button" @click.stop="emit('open', props.app)">
          查看对话 <span aria-hidden="true">→</span>
        </button>
        <a
          v-if="getDeployUrl(props.app)"
          :href="getDeployUrl(props.app)"
          target="_blank"
          rel="noopener noreferrer"
          @click.stop
        >查看作品 <span aria-hidden="true">↗</span></a>
      </div>
      <div v-if="props.variant === 'featured'" class="app-card__badge">精选</div>
    </div>

    <div class="app-card__info">
      <div class="app-card__title-row">
        <h3>{{ props.app.appName || '未命名应用' }}</h3>
        <Dropdown
          v-if="props.variant === 'workspace' && props.showActions"
          placement="bottomRight"
          :trigger="['hover', 'click']"
        >
          <button
            class="app-card__more"
            type="button"
            aria-label="应用操作"
            aria-haspopup="menu"
            @click.stop
          >
            ···
          </button>
          <template #overlay>
            <Menu class="app-card__menu" @click="handleMenuClick">
              <Menu.Item key="edit">编辑</Menu.Item>
              <Menu.Item key="remove" danger>删除</Menu.Item>
            </Menu>
          </template>
        </Dropdown>
      </div>
      <div class="app-card__author">
        <UserAvatar :avatar="props.app.user?.userAvatar" :name="authorName" size="sm" />
        <span class="app-card__user-name" :title="authorName">{{ authorName }}</span>
        <span class="app-card__date">创建于 {{ formatDate(props.app.createTime) }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.app-card {
  position: relative;
  min-width: 0;
  cursor: pointer;
}

.app-card__cover {
  position: relative;
}

.app-card__hover {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  right: 12px;
  bottom: 12px;
  left: 12px;
  padding: 10px 12px;
  color: #fff;
  font-size: 13px;
  text-align: center;
  background: rgb(16 41 58 / 76%);
  border-radius: 8px;
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px);
  transition: opacity 0.2s, transform 0.2s;
}

.app-card__cover:hover .app-card__hover,
.app-card__cover:focus-within .app-card__hover {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.app-card__hover span {
  margin-left: 4px;
  font-size: 16px;
}

.app-card__hover button,
.app-card__hover a {
  padding: 0;
  color: inherit;
  font: inherit;
  white-space: nowrap;
  text-decoration: none;
  background: none;
  border: 0;
  cursor: pointer;
}

.app-card__hover button:hover,
.app-card__hover a:hover {
  color: #b7f7e8;
}

.app-card__badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 5px 9px;
  color: #826120;
  font-size: 11px;
  font-weight: 700;
  background: #fff3cf;
  border-radius: 999px;
}

.app-card__info {
  min-width: 0;
  padding: 14px 4px 0;
}

.app-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.app-card__info h3 {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  margin: 0;
  color: #1b2d40;
  font-size: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-card__author {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 0;
  color: #98a2ac;
  font-size: 12px;
}

.app-card__user-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-card__date {
  flex: 0 0 auto;
  margin-left: auto;
  white-space: nowrap;
}

.app-card__more {
  flex: 0 0 auto;
  padding: 0 4px;
  color: #a4afb8;
  font-size: 21px;
  letter-spacing: 2px;
  background: none;
  border: 0;
  cursor: pointer;
}

.app-card__more:hover,
.app-card__more:focus-visible {
  color: #2b9387;
}

.app-card__menu {
  min-width: 100px;
}

@media (hover: none) {
  .app-card__hover {
    opacity: 1;
    pointer-events: auto;
    transform: none;
  }
}
</style>
