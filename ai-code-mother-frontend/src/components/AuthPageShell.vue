<script setup lang="ts">
/**
 * 登录/注册共用的展示外壳，不拥有表单数据，也不发起认证请求。
 * Props 提供左侧品牌介绍与右侧表单标题，form/footer 具名插槽承接调用页的交互内容。
 * 左侧优先展示 introStatus；未传状态时，才根据 introPoints 渲染能力标签。
 * headingId 将介绍区与主标题关联，formLabel 为表单所在区域提供可访问名称。
 */
import logoUrl from '@/assets/logo-display.png'

// 内容由登录或注册页单向传入；本组件不修改 Props，也无需向外触发业务事件。
defineProps<{
  // 介绍标题的 DOM 标识，需由调用方为当前页面提供。
  /** 保存页面主标题对应的锚点 ID。 */
  headingId: string
  /** 保存介绍区上方的短标签文案。 */
  introKicker: string
  /** 保存介绍区标题。 */
  introTitle: string
  /** 保存介绍区说明文案。 */
  introDescription: string
  // 可选的平台状态文案；与能力标签共用同一个展示位置。
  /** 保存介绍区状态提示文案。 */
  introStatus?: string
  // 无状态文案时可展示的一组能力标签，数组元素同时用作渲染键。
  /** 保存介绍区要点列表。 */
  introPoints?: string[]
  /** 保存表单卡片上方的短标签文案。 */
  cardEyebrow: string
  /** 保存表单卡片标题。 */
  cardTitle: string
  /** 保存表单卡片说明文案。 */
  cardDescription: string
  // 右侧表单区域的无障碍名称，区别于可见的 cardTitle。
  /** 保存表单区域的辅助说明文案。 */
  formLabel: string
}>()
</script>

<template>
  <main class="auth-page-shell">
    <section class="auth-page-shell__intro" :aria-labelledby="headingId">
      <div class="auth-page-shell__grid" aria-hidden="true"></div>
      <div class="auth-page-shell__intro-content">
        <div class="auth-page-shell__brand">
          <img :src="logoUrl" alt="" />
          <span>AI 零代码应用生成平台</span>
        </div>
        <p class="auth-page-shell__kicker">{{ introKicker }}</p>
        <h1 :id="headingId">{{ introTitle }}</h1>
        <p class="auth-page-shell__description">{{ introDescription }}</p>
        <div v-if="introStatus" class="auth-page-shell__status" aria-label="平台状态">
          <span></span>
          <span>{{ introStatus }}</span>
        </div>
        <div v-else-if="introPoints?.length" class="auth-page-shell__points" aria-label="平台能力">
          <span v-for="point in introPoints" :key="point">{{ point }}</span>
        </div>
      </div>
    </section>

    <section class="auth-page-shell__panel" :aria-label="formLabel">
      <div class="auth-page-shell__card">
        <div class="auth-page-shell__heading">
          <p>{{ cardEyebrow }}</p>
          <h2>{{ cardTitle }}</h2>
          <span>{{ cardDescription }}</span>
        </div>
        <slot name="form" />
        <slot name="footer" />
      </div>
    </section>
  </main>
</template>

<style scoped>
/* 桌面采用左右两列：介绍区可伸缩，表单区保留最小宽度；外壳覆盖完整视口高度。 */
.auth-page-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(420px, 0.9fr);
  min-height: 100vh;
  background: #f7faff;
}

.auth-page-shell__intro {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 600px;
  padding: 72px clamp(40px, 8vw, 128px);
  overflow: hidden;
  background: linear-gradient(135deg, #eef6ff 0%, #f9fcff 62%, #fff 100%);
}

/* 装饰网格绝对定位铺满介绍区，配合模板中的 aria-hidden 避免干扰辅助技术阅读。 */
.auth-page-shell__grid {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  background-image:
    linear-gradient(#dcecff 1px, transparent 1px),
    linear-gradient(90deg, #dcecff 1px, transparent 1px);
  background-position: center;
  background-size: 44px 44px;
  mask-image: linear-gradient(135deg, black 0%, transparent 72%);
}

/* 正文抬高层级以覆盖装饰背景，限制阅读宽度而不改变外层网格分栏。 */
.auth-page-shell__intro-content {
  position: relative;
  z-index: 1;
  max-width: 560px;
}

.auth-page-shell__brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #20334f;
  font-size: 15px;
  font-weight: 600;
}

.auth-page-shell__brand img {
  width: 34px;
  height: 34px;
  object-fit: contain;
  border-radius: 9px;
  box-shadow: 0 8px 18px rgb(55 126 220 / 16%);
}

.auth-page-shell__kicker,
.auth-page-shell__heading > p {
  margin: 0;
  color: #3478d4;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.auth-page-shell__kicker {
  margin-top: 78px;
}

.auth-page-shell__intro-content h1 {
  max-width: 520px;
  margin: 18px 0 20px;
  color: #14243b;
  font-size: clamp(36px, 4.2vw, 60px);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.18;
}

.auth-page-shell__description {
  max-width: 440px;
  margin: 0;
  color: #60718b;
  font-size: 16px;
  line-height: 1.8;
}

.auth-page-shell__status,
.auth-page-shell__points {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 40px;
}

.auth-page-shell__status {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  color: #48709d;
  font-size: 13px;
  background: rgb(255 255 255 / 72%);
  border: 1px solid #dcecff;
  border-radius: 999px;
}

.auth-page-shell__status > span:first-child {
  width: 7px;
  height: 7px;
  background: #2fc48d;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgb(47 196 141 / 12%);
}

.auth-page-shell__points span {
  padding: 8px 11px;
  color: #48709d;
  font-size: 12px;
  background: rgb(255 255 255 / 72%);
  border: 1px solid #dcecff;
  border-radius: 999px;
}

/* 表单区域在自身列内居中，内边距随视口伸缩。 */
.auth-page-shell__panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 56px clamp(24px, 6vw, 96px);
  background: #fff;
}

.auth-page-shell__card {
  width: min(100%, 400px);
}

.auth-page-shell__heading h2 {
  margin: 12px 0 8px;
  color: #182940;
  font-size: 30px;
  font-weight: 650;
  line-height: 1.3;
}

.auth-page-shell__heading > span {
  color: #8492a6;
  font-size: 14px;
}

/* 表单位于父页面传入的插槽中，使用深度选择器统一登录和注册的输入、按钮与错误样式。 */
.auth-page-shell :deep(.auth-form) {
  margin-top: 36px;
}

.auth-page-shell :deep(.field-label) {
  display: block;
  margin-bottom: 9px;
  color: #3b4c64;
  font-size: 13px;
  font-weight: 600;
}

.auth-page-shell :deep(.field-label-spaced) {
  margin-top: 20px;
}

.auth-page-shell :deep(.field-input) {
  box-sizing: border-box;
  width: 100%;
  height: 48px;
  padding: 0 14px;
  color: #1d2c40;
  font: inherit;
  background: #fbfdff;
  border: 1px solid #dbe5f0;
  border-radius: 8px;
  outline: none;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    background-color 0.2s;
}

.auth-page-shell :deep(.field-input::placeholder) {
  color: #a9b6c6;
}

/* 输入聚焦时保留明确的边框与光晕反馈，替代原生 outline。 */
.auth-page-shell :deep(.field-input:focus) {
  background: #fff;
  border-color: #4a91e8;
  box-shadow: 0 0 0 3px rgb(74 145 232 / 12%);
}

.auth-page-shell :deep(.password-label-row) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 22px;
}

.auth-page-shell :deep(.password-label-row .field-label) {
  margin-bottom: 9px;
}

.auth-page-shell :deep(.text-button) {
  padding: 0;
  color: #5d8fca;
  font: inherit;
  font-size: 12px;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.auth-page-shell :deep(.text-button:hover) {
  color: #246fc1;
}

/* 提交期间通过透明度和鼠标指针提示禁用状态，实际交互禁用由模板属性控制。 */
.auth-page-shell :deep(.field-input:disabled),
.auth-page-shell :deep(.submit-button:disabled) {
  cursor: not-allowed;
  opacity: 0.65;
}

.auth-page-shell :deep(.error-message) {
  margin: 14px 0 0;
  color: #d94b5b;
  font-size: 13px;
}

.auth-page-shell :deep(.submit-button) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 50px;
  margin-top: 26px;
  padding: 0 18px;
  color: #fff;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  background: var(--color-brand);
  border: 0;
  border-radius: 8px;
  box-shadow: 0 10px 20px rgb(38 121 217 / 18%);
  cursor: pointer;
  transition:
    background-color 0.2s,
    transform 0.2s,
    box-shadow 0.2s;
}

.auth-page-shell :deep(.submit-button:hover:not(:disabled)) {
  background: #1768c5;
  box-shadow: 0 12px 24px rgb(38 121 217 / 24%);
  transform: translateY(-1px);
}

.auth-page-shell :deep(.auth-footer) {
  margin: 26px 0 0;
  color: #8492a6;
  font-size: 13px;
  text-align: center;
}

.auth-page-shell :deep(.auth-footer a) {
  color: var(--color-brand);
  font-weight: 600;
  text-decoration: none;
}

.auth-page-shell :deep(.auth-footer a:hover) {
  text-decoration: underline;
}

/* 平板与较窄屏幕转为上下单列，介绍区高度由内容决定，避免挤压表单。 */
@media (max-width: 900px) {
  .auth-page-shell {
    grid-template-columns: 1fr;
  }

  .auth-page-shell__intro {
    min-height: auto;
    padding: 56px 32px 48px;
  }

  .auth-page-shell__kicker {
    margin-top: 48px;
  }

  .auth-page-shell__intro-content h1 {
    font-size: clamp(34px, 7vw, 48px);
  }

  .auth-page-shell__panel {
    padding: 52px 24px 72px;
  }
}

/* 手机进一步收紧边距和标题字号，保持表单可读宽度。 */
@media (max-width: 480px) {
  .auth-page-shell__intro {
    padding: 40px 20px 36px;
  }

  .auth-page-shell__intro-content h1 {
    margin-top: 14px;
    font-size: 34px;
  }

  .auth-page-shell__description {
    font-size: 14px;
  }

  .auth-page-shell__status,
  .auth-page-shell__points {
    margin-top: 30px;
  }

  .auth-page-shell__panel {
    padding: 40px 20px 56px;
  }
}
</style>
