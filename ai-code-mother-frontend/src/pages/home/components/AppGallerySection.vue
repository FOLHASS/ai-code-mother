<script setup lang="ts">
import { computed } from 'vue'

import AppCard from '@/components/AppCard.vue'

const props = withDefaults(
  defineProps<{
    apps: API.AppVO[]
    total: number
    page: number
    pageSize: number
    loading: boolean
    variant?: 'workspace' | 'featured'
    loggedOut?: boolean
    emptyText: string
  }>(),
  { variant: 'workspace', loggedOut: false },
)

const emit = defineEmits<{
  open: [app: API.AppVO]
  edit: [app: API.AppVO]
  remove: [app: API.AppVO]
  'page-change': [page: number]
}>()
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
.gallery-section + .gallery-section {
  margin-top: 66px;
}
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
