<script setup lang="ts">
/**
 * 作品卡片：展示封面、名称、作者和创建时间，并通过事件把查看、编辑、删除交给调用页面。
 * 封面浮层左侧始终显示“查看对话”，右侧仅在存在部署地址时显示“查看作品”。
 * 整卡点击进入对话；链接和菜单用 stop 阻止冒泡，避免一次点击同时触发多个入口。
 */
import { computed } from 'vue'
import { Dropdown, Menu } from 'ant-design-vue'
import type { MenuProps } from 'ant-design-vue'

import { formatDate, getDeployUrl } from '@/utils/app.ts'
import AppCover from '@/components/AppCover.vue'
import UserAvatar from '@/components/UserAvatar.vue'

// workspace 对应“我的作品”，featured 对应精选；差异仅用于徽标、占位配色和操作菜单可见性。
type AppCardVariant = 'workspace' | 'featured'

// app 来自列表接口并包含 user VO；组件只读此对象，不在内部请求详情或修改业务字段。
const props = withDefaults(
  defineProps<{
    app: API.AppVO
    variant?: AppCardVariant
    // 作为工作区卡片操作菜单的额外开关；即使为 true，精选卡片仍不会显示编辑/删除菜单。
    showActions?: boolean
  }>(),
  {
    variant: 'workspace',
    showActions: true,
  },
)

// 作者昵称去空白后优先展示；缺少昵称则使用账号，再使用统一作者兜底文案。
const authorName = computed(() => props.app.user?.userName?.trim()
  || props.app.user?.userAccount?.trim()
  || 'NoCode 创作者')

// 事件均携带当前 app，父页面决定路由、权限校验、弹窗及删除后刷新，卡片不复制这些流程。
const emit = defineEmits<{
  open: [app: API.AppVO]
  edit: [app: API.AppVO]
  remove: [app: API.AppVO]
}>()

/**
 * 菜单的点击事件带有原生 domEvent，先阻断传播再按菜单 key 分发业务事件。
 * 菜单本身不调用接口，因此父级可以为“编辑”使用弹窗或独立页面等不同实现。
 */
const handleMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
  domEvent.stopPropagation()
  if (key === 'edit') emit('edit', props.app)
  if (key === 'remove') emit('remove', props.app)
}
// 模板中的部署链接使用 getDeployUrl，打开部署后的作品；不与生成目录下的网站预览地址混用。
// 作者头像继续复用 UserAvatar，昵称与时间共用信息行，长文本通过样式缩略保持卡片宽度稳定。
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
/* 卡片作为可点击整体，min-width: 0 使其在网格中允许标题和用户名正常收缩。 */
.app-card {
  position: relative;
  min-width: 0;
  cursor: pointer;
}

.app-card__cover {
  position: relative;
}

/* 浮层绝对定位在封面底部；默认透明且不接收鼠标事件，避免隐藏按钮拦截卡片点击。 */
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

/* 鼠标悬浮或键盘焦点进入封面时展开操作区，两个入口在左右两侧排列。 */
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

/* 标题与三点菜单同处一行：标题可以省略，菜单保持固定占位。 */
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

/* 作者头像、姓名和创建时间共享一行；日期不收缩，并通过 auto 外边距靠右。 */
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

/* 触屏设备无法稳定触发 hover，直接显示封面操作区以保留查看作品入口的可达性。 */
@media (hover: none) {
  .app-card__hover {
    opacity: 1;
    pointer-events: auto;
    transform: none;
  }
}
</style>
