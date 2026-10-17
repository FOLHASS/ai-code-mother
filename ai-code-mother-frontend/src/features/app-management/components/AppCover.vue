<script setup lang="ts">
import type { AppSummary } from '@/shared/domain/models.ts'
/**
 * 多处复用的应用封面展示：卡片、详情摘要、管理表格和弹窗共享图片裁切及默认占位。
 * 只依赖应用名称和封面字段，不绑定任何页面状态，也不请求接口或修改传入数据。
 */
import { computed } from 'vue'

import { getAppCover, getInitial } from '@/utils/app.ts'

// 四种尺寸对应现有调用场景，具体宽高和圆角由同名修饰类控制。
type AppCoverSize = 'card' | 'summary' | 'table' | 'modal'

// 使用 Pick 限制依赖字段，调用者无需提供完整 AppVO；空应用也能正常显示占位图。
const props = withDefaults(
  defineProps<{
    app?: Pick<AppSummary, 'appName' | 'cover'> | null
    size?: AppCoverSize
    // 精选状态只切换无封面时的占位配色，已有图片仍按原图展示。
    featured?: boolean
    // 未自定义替代文本时，模板使用应用名称，使图片的辅助阅读信息与当前作品一致。
    alt?: string
  }>(),
  {
    app: null,
    size: 'card',
    featured: false,
    alt: '应用封面',
  },
)

// getAppCover 负责统一封面地址读取；模板有地址才渲染 img，否则显示渐变与首字符占位。
const coverUrl = computed(() => getAppCover(props.app))
// 应用名称和首字符都由 props 派生，父级修改名称后无需手动同步封面状态。
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
/* 基础容器裁切超出边界的图片和装饰形状，保证所有尺寸的圆角与占位内容一致。 */
.app-cover {
  position: relative;
  overflow: hidden;
  background: #f1f6fa;
  border: 1px solid #edf1f3;
}

/* 尺寸修饰类：卡片按容器宽度铺开，表格与弹窗使用固定宽高并禁止 flex 自动压缩。 */
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

/* object-fit: cover 铺满容器；卡片悬浮只缩放图片，不影响父级布局尺寸。 */
.app-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s;
}

.app-cover--card:hover img {
  transform: scale(1.04);
}

/* 无图片时用渐变、椭圆和应用首字符组成纯 CSS 占位，无需额外请求默认图片。 */
.app-cover__placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: #193b4b;
  place-items: center;
  background:
    radial-gradient(circle at 30% 30%, #c5f4e7, transparent 30%),
    linear-gradient(135deg, #eefaf9, #b9dcf4);
}

/* 精选占位使用深色渐变，与普通工作区封面区分，但不影响应用本身的优先级。 */
.app-cover--featured .app-cover__placeholder {
  background:
    radial-gradient(circle at 70% 30%, #d7e5ff, transparent 34%),
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

/* 小尺寸表格单独缩小首字符并隐藏装饰星标，避免图形溢出紧凑的单元格。 */
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

/* 移动端单列卡片增加封面高度；摘要、表格和弹窗尺寸继续沿用各自的既定样式。 */
@media (max-width: 620px) {
  .app-cover--card {
    height: 210px;
  }
}
</style>
