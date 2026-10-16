<script setup lang="ts">
/**
 * 首页提示词展示与输入区：仅维护草稿，点击示例会回填草稿，提交事件交由首页进行校验与创建。
 * isCreating 从父级传入，用于将接口请求状态同步到输入框、发送按钮与按钮内的加载动画。
 */
import { ref } from 'vue'

// 组件不直接请求后端，也不自行改变创建状态；异步流程的所有权留在 HomePage。
defineProps<{ isCreating: boolean }>()
// 原样向上提交当前草稿，去空白、登录引导和创建失败提示统一由页面处理。
const emit = defineEmits<{ create: [prompt: string] }>()
// 草稿只属于此输入区，示例按钮通过 v-model 所绑定的同一个 ref 回填，不会立即发起创建。
const prompt = ref('')
// 表单 submit 同时覆盖点击发送和表单提交入口，模板通过 prevent 避免浏览器刷新页面。
const submit = () => emit('create', prompt.value)
</script>

<template>
  <section class="hero-section">
    <div class="hero-orb orb-left"></div>
    <div class="hero-orb orb-right"></div>
    <div class="hero-content">
      <p class="hero-kicker"><span></span> AI 创作工作台</p>
      <h1>一句话 <b>呈所想</b></h1>
      <p class="hero-subtitle">与 AI 对话，轻松创建应用和网站</p>
      <form class="prompt-card" @submit.prevent="submit">
        <textarea
          v-model="prompt"
          :disabled="isCreating"
          rows="4"
          placeholder="使用 NoCode 创建一个高效的小工具，帮我计算……"
          aria-label="输入应用需求"
        ></textarea>
        <div class="prompt-footer">
          <span class="prompt-hint">描述越具体，生成效果越好</span>
          <button class="prompt-submit" type="submit" :disabled="isCreating">
            <span v-if="isCreating" class="spinner"></span><span v-else aria-hidden="true">↑</span>
          </button>
        </div>
      </form>
      <div class="prompt-examples" aria-label="示例需求">
        <button type="button" @click="prompt = '帮我做一个简洁的个人博客网站'">个人博客网站</button>
        <button type="button" @click="prompt = '帮我做一个企业服务介绍网站'">企业网站</button>
        <button type="button" @click="prompt = '帮我做一个电商运营后台'">电商运营后台</button>
        <button type="button" @click="prompt = '帮我做一个暗黑风格的主题社区'">暗黑主题社区</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Hero 的渐变背景、圆环和伪元素仅负责装饰，正文通过单独层级保持可点击与可阅读。 */
.hero-section {
  position: relative;
  min-height: 595px;
  overflow: hidden;
  background: linear-gradient(120deg, #f8fdfb 0%, #fbffff 36%, #d5fbf0 64%, #6db8ec 100%);
}
/* 透明光斑叠加背景，pointer-events: none 防止装饰层拦截输入与按钮交互。 */
.hero-section::after {
  position: absolute;
  inset: 0;
  content: '';
  background:
    radial-gradient(circle at 53% 37%, rgb(255 255 255 / 92%), transparent 23%),
    radial-gradient(circle at 84% 78%, rgb(37 144 220 / 26%), transparent 34%);
  pointer-events: none;
}
.hero-orb {
  position: absolute;
  border: 1px solid rgb(255 255 255 / 48%);
  border-radius: 50%;
  transform: rotate(-17deg);
  opacity: 0.8;
}
.orb-left {
  left: -170px;
  bottom: -290px;
  width: 680px;
  height: 440px;
}
.orb-right {
  right: -150px;
  top: -210px;
  width: 720px;
  height: 500px;
}
/* 内容居中且限制最大宽度；标题字号用 clamp 随视口变化，输入区再限制为更窄的阅读宽度。 */
.hero-content {
  position: relative;
  z-index: 1;
  width: min(920px, calc(100% - 40px));
  margin: 0 auto;
  padding: 72px 0 80px;
  text-align: center;
}
.hero-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: #347a9a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
}
.hero-kicker span {
  width: 7px;
  height: 7px;
  background: #21c6a5;
  border-radius: 50%;
  box-shadow: 0 0 0 5px rgb(33 198 165 / 15%);
}
.hero-content h1 {
  margin: 25px 0 8px;
  color: #111c2a;
  font-size: clamp(44px, 7vw, 82px);
  font-weight: 750;
  letter-spacing: -0.04em;
  line-height: 1.05;
}
.hero-content h1 b {
  color: #101d2c;
  font-weight: inherit;
}
.hero-subtitle {
  margin: 0 0 35px;
  color: #607789;
  font-size: 18px;
}
/* 提示词面板负责白底与阴影；textarea 允许垂直调整高度以容纳较长需求。 */
.prompt-card {
  width: min(100%, 780px);
  margin: 0 auto;
  padding: 18px 18px 13px;
  text-align: left;
  background: rgb(255 255 255 / 93%);
  border: 1px solid rgb(255 255 255 / 80%);
  border-radius: 20px;
  box-shadow: 0 20px 50px rgb(49 126 152 / 16%);
}
.prompt-card textarea {
  display: block;
  width: 100%;
  min-height: 105px;
  padding: 0 5px;
  color: #213a53;
  font: inherit;
  font-size: 18px;
  line-height: 1.55;
  background: transparent;
  border: 0;
  outline: 0;
  resize: vertical;
}
.prompt-card textarea::placeholder {
  color: #a1adba;
}
/* 输入提示位于左侧、发送按钮位于右侧，创建中通过禁用态和 spinner 表达等待状态。 */
.prompt-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}
.prompt-hint {
  color: #a0acb7;
  font-size: 12px;
}
.prompt-submit {
  display: grid;
  width: 45px;
  height: 45px;
  color: #fff;
  font-size: 25px;
  font-weight: 300;
  place-items: center;
  background: #8a9499;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}
.prompt-submit:not(:disabled):hover {
  background: #1d827a;
  transform: translateY(-1px);
}
.prompt-submit:disabled {
  cursor: wait;
  opacity: 0.7;
}
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgb(255 255 255 / 35%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
/* 示例标签按可用宽度自动换行；它们只更新输入文案，不承担异步业务。 */
.prompt-examples {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 17px;
}
.prompt-examples button {
  padding: 9px 17px;
  color: #577284;
  font: inherit;
  font-size: 13px;
  background: rgb(255 255 255 / 88%);
  border: 1px solid rgb(255 255 255 / 70%);
  border-radius: 999px;
  cursor: pointer;
}
.prompt-examples button:hover {
  color: #168f80;
  border-color: #8bdccb;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
/* 小屏收紧首屏顶部留白并调小标题、副标题，保留原来的输入和示例操作结构。 */
@media (max-width: 620px) {
  .hero-content {
    padding-top: 52px;
  }
  .hero-content h1 {
    font-size: 48px;
  }
  .hero-subtitle {
    font-size: 15px;
  }
}
</style>
