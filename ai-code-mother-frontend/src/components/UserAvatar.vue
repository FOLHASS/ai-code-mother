<script setup lang="ts">
import { computed } from 'vue'

import { getInitial } from '@/utils/app.ts'

const props = withDefaults(
  defineProps<{
    avatar?: string
    name?: string
    size?: 'sm' | 'md' | 'lg'
    alt?: string
  }>(),
  {
    avatar: '',
    name: '用户',
    size: 'md',
    alt: '',
  },
)

const displayName = computed(() => props.name?.trim() || '用户')
const avatarAlt = computed(() => props.alt || `${displayName.value}的头像`)
const initial = computed(() => getInitial(displayName.value))
</script>

<template>
  <div class="user-avatar" :class="`user-avatar--${size}`">
    <img v-if="avatar?.trim()" :src="avatar" :alt="avatarAlt" />
    <span v-else>{{ initial }}</span>
  </div>
</template>

<style scoped>
.user-avatar {
  display: grid;
  flex: 0 0 auto;
  overflow: hidden;
  place-items: center;
  color: #2679d9;
  font-weight: 700;
  background: #e8f2ff;
  border-radius: 50%;
}

.user-avatar--sm {
  width: 30px;
  height: 30px;
  font-size: 13px;
}

.user-avatar--md {
  width: 42px;
  height: 42px;
  font-size: 17px;
}

.user-avatar--lg {
  width: 88px;
  height: 88px;
  font-size: 30px;
  border: 4px solid #edf5ff;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
