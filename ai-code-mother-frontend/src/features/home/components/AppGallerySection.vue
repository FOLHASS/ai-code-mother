<script setup lang="ts">
import type { AppSummary } from '@/shared/domain/models.ts'
/**
 * 首页通用作品区：按“未登录 → 加载中 → 列表或空态”顺序展示内容，并提供上一页/下一页。
 * 头部和未登录提示由具名插槽定制；列表请求、实际路由和修改操作均交给父页面。
 */
import { computed } from 'vue'

import { AppCard } from '@/features/app-management/components'

// 所有列表数据与分页状态从父级传入，本组件不维护第二份页码或加载状态。
const props = withDefaults(
  defineProps<{
    // 后端 VO 已包含卡片所需应用信息及作者信息，直接传给 AppCard。
    apps: readonly AppSummary[]
    total: number
    page: number
    pageSize: number
    loading: boolean
    // workspace 显示本人作品操作；featured 保留相同卡片浏览方式并隐藏编辑/删除菜单。
    variant?: 'workspace' | 'featured'
    loggedOut?: boolean
    emptyText: string
  }>(),
  { variant: 'workspace', loggedOut: false },
)

// 卡片事件携带原应用对象向上透传；page-change 只报告目标页，父级负责请求并回传新数据。
const emit = defineEmits<{
  open: [app: AppSummary]
  edit: [app: AppSummary]
  remove: [app: AppSummary]
  'page-change': [page: number]
}>()
// 即使没有记录也保留最少一页的计算结果，分页区域本身只在总数大于每页数量时显示。
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
</script>

<template>
  <section class="gallery-section" :class="{ 'featured-section': variant === 'featured' }">
    <slot name="header" />
    <slot v-if="loggedOut" name="logged-out" />
    <div v-else-if="loading" class="card-grid loading-grid">
      <div v-for="n in 3" :key="n" class="skeleton-card"></div>
    </div>
    <div v-else-if="apps.length" class="card-grid">
      <AppCard
        v-for="app in apps"
        :key="app.id"
        :app="app"
        :variant="variant"
        :show-actions="variant === 'workspace'"
        @open="emit('open', $event)"
        @edit="emit('edit', $event)"
        @remove="emit('remove', $event)"
      />
    </div>
    <div v-else class="plain-empty">{{ emptyText }}</div>
    <div v-if="!loggedOut && total > pageSize" class="pagination-bar">
      <button type="button" :disabled="page <= 1 || loading" @click="emit('page-change', page - 1)">
        上一页
      </button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button
        type="button"
        :disabled="page >= totalPages || loading"
        @click="emit('page-change', page + 1)"
      >
        下一页
      </button>
    </div>
  </section>
</template>

<style scoped>
/* 同一画廊中相邻业务分区保持较大竖向间距，避免把两套独立分页误认为同一列表。 */
.gallery-section + .gallery-section {
  margin-top: 66px;
}
/* 桌面三列卡片栅格，minmax(0, 1fr) 允许长标题缩略；加载骨架复用相同网格。 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
}
.plain-empty {
  padding: 45px 20px;
  color: #9aa8b1;
  font-size: 13px;
  text-align: center;
  background: #fbfdfd;
  border: 1px dashed #e3ebed;
  border-radius: 12px;
}
/* 翻页按钮在页面边界和加载期间禁用；文案仍展示父级传入的当前页。 */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-top: 25px;
  color: #8c9ba4;
  font-size: 12px;
}
.pagination-bar button {
  padding: 6px 11px;
  color: #547580;
  background: #fff;
  border: 1px solid #d9e8e8;
  border-radius: 6px;
  cursor: pointer;
}
.pagination-bar button:disabled {
  color: #c7d1d4;
  cursor: not-allowed;
}
/* 骨架使用移动背景模拟加载，无额外计时器；真实数据到达后由条件渲染整体替换。 */
.skeleton-card {
  height: 240px;
  background: linear-gradient(100deg, #f0f4f6 30%, #f9fbfb 45%, #f0f4f6 60%);
  background-size: 200% 100%;
  border-radius: 14px;
  animation: shimmer 1.3s infinite;
}
@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}
/* 平板降为两列，手机降为一列，卡片组件本身无需感知屏幕宽度。 */
@media (max-width: 900px) {
  .card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 620px) {
  .card-grid {
    grid-template-columns: 1fr;
    gap: 22px;
  }
}
</style>
