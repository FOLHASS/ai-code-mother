<script setup lang="ts">
import { computed } from 'vue'

import { getAppCover, getInitial } from '@/utils/app.ts'

type AppCoverSize = 'card' | 'summary' | 'table' | 'modal'

const props = withDefaults(
  defineProps<{
    app?: Pick<API.AppVO, 'appName' | 'cover'> | null
    size?: AppCoverSize
    featured?: boolean
    alt?: string
  }>(),
  {
    app: null,
    size: 'card',
    featured: false,
    alt: '应用封面',
  },
)

const coverUrl = computed(() => getAppCover(props.app))
const appName = computed(() => props.app?.appName || '未命名应用')
const initial = computed(() => getInitial(props.app?.appName))
</script>

<template>
  <div class="app-cover" :class="[`app-cover--${size}`, { 'app-cover--featured': featured }]">
    <img v-if="coverUrl" :src="coverUrl" :alt="alt === '应用封面' ? appName : alt" />
    <div v-else class="app-cover__placeholder">
      <span>{{ initial }}</span>
      <i aria-hidden="true">✦</i>
    </div>
  </div>
</template>

<style scoped>
.app-cover {
  position: relative;
  overflow: hidden;
  background: #f1f6fa;
  border: 1px solid #edf1f3;
}

.app-cover--card {
  height: 195px;
  border-radius: 14px;
}

.app-cover--summary {
  height: 145px;
  border-radius: 9px;
}

.app-cover--table {
  width: 38px;
  height: 32px;
  flex: 0 0 auto;
  border-radius: 6px;
}

.app-cover--modal {
  width: 180px;
  height: 130px;
  flex: 0 0 auto;
  border-radius: 9px;
}

.app-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s;
}

.app-cover--card:hover img {
  transform: scale(1.04);
}

.app-cover__placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: #193b4b;
  place-items: center;
  background: radial-gradient(circle at 30% 30%, #c5f4e7, transparent 30%),
    linear-gradient(135deg, #eefaf9, #b9dcf4);
}

.app-cover--featured .app-cover__placeholder {
  background: radial-gradient(circle at 70% 30%, #d7e5ff, transparent 34%),
    linear-gradient(135deg, #2b4b7b, #8bc1dc);
}

.app-cover__placeholder::before {
  width: 240px;
  height: 150px;
  content: '';
  border: 1px solid rgb(255 255 255 / 65%);
  border-radius: 50%;
  transform: rotate(-25deg);
}

.app-cover__placeholder span {
  position: absolute;
  color: #fff;
  font-size: 64px;
  font-weight: 750;
  text-shadow: 0 4px 13px rgb(21 97 105 / 20%);
}

.app-cover--table .app-cover__placeholder span {
  font-size: 15px;
}

.app-cover--summary .app-cover__placeholder span,
.app-cover--modal .app-cover__placeholder span {
  font-size: 58px;
}

.app-cover__placeholder i {
  position: absolute;
  right: 24px;
  bottom: 18px;
  color: rgb(255 255 255 / 75%);
  font-size: 30px;
  font-style: normal;
}

.app-cover--table .app-cover__placeholder i {
  display: none;
}

@media (max-width: 620px) {
  .app-cover--card {
    height: 210px;
  }
}
</style>
