<script setup lang="ts">
/**
 * 通用头像展示组件：有非空图片地址时渲染图片，否则用显示名称的首字符作为占位。
 * 组件仅接收展示 Props，不请求用户信息，不向外修改状态；父组件决定用户来源和尺寸。
 * 图片裁切、圆形占位和三档尺寸在 scoped 样式中统一实现。
 */
import { computed } from 'vue'

import { getInitial } from '@/utils/app.ts'

// 默认昵称为“用户”、尺寸为 md；alt 留空时由显示名称生成图片替代文本。
const props = withDefaults(
  defineProps<{
    // 头像图片地址；模板只以去空格后的非空判断决定是否使用图片。
    avatar?: string
    name?: string
    // 尺寸限定为组件已有的三档样式，分别适用于列表、常规展示和个人资料。
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

// 所有展示派生值都依赖 Props 计算，调用方替换用户后会自动重新计算。
const displayName = computed(() => props.name?.trim() || '用户')
// 优先使用调用方提供的替代文本，否则补全用户头像的可访问描述。
const avatarAlt = computed(() => props.alt || `${displayName.value}的头像`)
// 缺少头像时复用公共首字符工具，不在组件中重复实现名称处理。
const initial = computed(() => getInitial(displayName.value))
</script>

<template>
  <div class="user-avatar" :class="`user-avatar--${size}`">
    <img v-if="avatar?.trim()" :src="avatar" :alt="avatarAlt" />
    <span v-else>{{ initial }}</span>
  </div>
</template>

<style scoped>
/* 固定为不被 flex 压缩的圆形容器，网格布局让首字符和图片内容居中。 */
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

/* 三档尺寸通过模板上的动态 class 选择，保持同一个头像组件的布局规则。 */
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

/* 图片铺满容器并按比例裁切，避免头像源尺寸不同导致布局抖动。 */
.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
