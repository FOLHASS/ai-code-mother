<script setup lang="ts">
import { useRouter } from 'vue-router'

import logoUrl from '@/assets/logo.png'

const router = useRouter()

const goToAlgorithm = () => {
  void router.push('/algorithm')
}

const goToLogin = () => {
  void router.push('/user/login')
}
</script>

<template>
  <main class="home-page">
    <section class="hero-section">
      <div class="hero-copy">
        <div class="eyebrow"><span class="eyebrow-dot"></span> AI POWERED WORKSPACE</div>
        <h1>让每一个想法，<br /><span>都能快速成为应用。</span></h1>
        <p class="hero-description">
          用自然语言描述你的需求，AI 帮你完成从想法到产品的第一步。
          简单、清晰、可持续迭代。
        </p>
        <div class="hero-actions">
          <button class="primary-cta" type="button" @click="goToAlgorithm">
            开始创建应用 <span aria-hidden="true">→</span>
          </button>
          <button class="secondary-cta" type="button" @click="goToLogin">登录平台</button>
        </div>
        <div class="hero-note"><span></span> 面向创作者的 AI 应用工作台</div>
      </div>

      <div class="hero-visual" aria-label="AI 应用工作台预览">
        <div class="visual-orbit orbit-one"></div>
        <div class="visual-orbit orbit-two"></div>
        <div class="visual-glow"></div>
        <div class="visual-card main-preview">
          <div class="preview-topbar">
            <span class="window-dots"><i></i><i></i><i></i></span>
            <span>AI 应用工作台</span>
            <span class="preview-status">已就绪</span>
          </div>
          <div class="preview-body">
            <div class="preview-sidebar">
              <div class="sidebar-logo"><img :src="logoUrl" alt="" /></div>
              <span class="sidebar-line active"></span>
              <span class="sidebar-line"></span>
              <span class="sidebar-line short"></span>
            </div>
            <div class="preview-content">
              <div class="preview-heading"><span>新建应用</span><small>AI 助手在线</small></div>
              <div class="prompt-box">
                <span class="prompt-icon">✦</span>
                <span>帮我创建一个简洁的任务管理应用...</span>
                <b>↑</b>
              </div>
              <div class="preview-blocks"><span></span><span></span><span></span></div>
            </div>
          </div>
        </div>
        <div class="floating-badge badge-ai"><span>✦</span> 智能生成中</div>
        <div class="floating-badge badge-code"><span>{ }</span> 可视化代码</div>
      </div>
    </section>

    <section class="feature-section">
      <div class="section-intro">
        <p class="section-eyebrow">A BETTER WAY TO BUILD</p>
        <h2>把复杂的开发，<br />变成清晰的创作。</h2>
      </div>
      <div class="feature-grid">
        <article class="feature-item">
          <span class="feature-number">01</span>
          <h3>说出你的想法</h3>
          <p>用自然语言描述目标，减少从零开始的复杂配置。</p>
        </article>
        <article class="feature-item">
          <span class="feature-number">02</span>
          <h3>AI 帮你生成</h3>
          <p>从页面结构到核心逻辑，快速搭建应用雏形。</p>
        </article>
        <article class="feature-item">
          <span class="feature-number">03</span>
          <h3>持续优化迭代</h3>
          <p>随时调整你的需求，让应用随着想法一起成长。</p>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.home-page {
  overflow: hidden;
  color: #1c3553;
}

.hero-section {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(460px, 1.1fr);
  align-items: center;
  min-height: 590px;
  padding: 34px 0 78px;
}

.hero-section::before {
  position: absolute;
  top: -220px;
  right: -180px;
  width: 650px;
  height: 650px;
  content: '';
  background: radial-gradient(circle, rgb(184 222 255 / 32%) 0, rgb(184 222 255 / 0%) 68%);
  pointer-events: none;
}

.hero-copy {
  position: relative;
  z-index: 1;
  max-width: 600px;
}

.eyebrow,
.section-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: #327bcf;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.15em;
}

.eyebrow-dot {
  width: 7px;
  height: 7px;
  background: #4ea8ee;
  border-radius: 50%;
  box-shadow: 0 0 0 5px rgb(78 168 238 / 12%);
}

.hero-copy h1 {
  margin: 24px 0 22px;
  color: #153353;
  font-size: clamp(42px, 5vw, 68px);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.17;
}

.hero-copy h1 span {
  color: #2478d6;
}

.hero-description {
  max-width: 490px;
  margin: 0;
  color: #687e96;
  font-size: 16px;
  line-height: 1.85;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 34px;
}

.primary-cta,
.secondary-cta {
  height: 46px;
  padding: 0 18px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  border-radius: 7px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, background-color 0.2s;
}

.primary-cta {
  color: #fff;
  background: #2579d8;
  border: 1px solid #2579d8;
  box-shadow: 0 10px 20px rgb(37 121 216 / 18%);
}

.primary-cta span {
  margin-left: 12px;
  font-size: 17px;
}

.primary-cta:hover {
  background: #1768c5;
  box-shadow: 0 12px 24px rgb(37 121 216 / 25%);
  transform: translateY(-1px);
}

.secondary-cta {
  color: #4e6987;
  background: #fff;
  border: 1px solid #dbe7f3;
}

.secondary-cta:hover {
  color: #2478d6;
  border-color: #a9caec;
  transform: translateY(-1px);
}

.hero-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 22px;
  color: #92a2b3;
  font-size: 12px;
}

.hero-note span {
  width: 5px;
  height: 5px;
  background: #39b987;
  border-radius: 50%;
}

.hero-visual {
  position: relative;
  min-height: 480px;
}

.visual-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 430px;
  height: 430px;
  background: radial-gradient(circle, rgb(133 202 255 / 30%), transparent 68%);
  transform: translate(-42%, -50%);
}

.visual-orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 1px solid rgb(119 188 241 / 33%);
  border-radius: 50%;
  transform: translate(-50%, -50%) rotate(-18deg);
}

.orbit-one {
  width: 470px;
  height: 300px;
}

.orbit-two {
  width: 540px;
  height: 370px;
  transform: translate(-50%, -50%) rotate(26deg);
}

.main-preview {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  width: min(560px, 95%);
  overflow: hidden;
  background: rgb(255 255 255 / 94%);
  border: 1px solid #dceaf7;
  border-radius: 12px;
  box-shadow: 0 26px 60px rgb(42 105 167 / 16%);
  transform: translate(-45%, -50%) rotate(-3deg);
}

.preview-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 42px;
  padding: 0 16px;
  color: #71849a;
  font-size: 11px;
  border-bottom: 1px solid #edf3f8;
}

.window-dots {
  display: flex;
  gap: 5px;
}

.window-dots i {
  width: 6px;
  height: 6px;
  background: #c7dced;
  border-radius: 50%;
}

.preview-status {
  color: #31a77b;
}

.preview-body {
  display: flex;
  min-height: 280px;
}

.preview-sidebar {
  display: flex;
  flex: 0 0 68px;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding-top: 20px;
  background: #f7fbff;
  border-right: 1px solid #edf3f8;
}

.sidebar-logo {
  width: 28px;
  height: 28px;
  overflow: hidden;
  border-radius: 8px;
}

.sidebar-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sidebar-line {
  width: 24px;
  height: 5px;
  background: #c8dbec;
  border-radius: 3px;
}

.sidebar-line.active {
  background: #6eb2ec;
  box-shadow: 0 0 0 5px #e8f4ff;
}

.sidebar-line.short {
  width: 17px;
}

.preview-content {
  flex: 1;
  padding: 30px 32px;
}

.preview-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #263f5d;
  font-size: 18px;
  font-weight: 600;
}

.preview-heading small {
  color: #49ae87;
  font-size: 10px;
  font-weight: 500;
}

.prompt-box {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 58px;
  margin-top: 34px;
  padding: 0 14px;
  color: #7b8fa5;
  font-size: 12px;
  background: #fbfdff;
  border: 1px solid #dceaf5;
  border-radius: 8px;
  box-shadow: 0 6px 16px rgb(62 125 181 / 7%);
}

.prompt-icon {
  color: #368be1;
  font-size: 18px;
}

.prompt-box b {
  display: grid;
  width: 24px;
  height: 24px;
  margin-left: auto;
  place-items: center;
  color: #fff;
  background: #3d91e2;
  border-radius: 6px;
}

.preview-blocks {
  display: grid;
  grid-template-columns: 1.1fr 0.8fr 0.55fr;
  gap: 10px;
  margin-top: 22px;
}

.preview-blocks span {
  height: 76px;
  background: #edf6ff;
  border: 1px solid #e1eef9;
  border-radius: 7px;
}

.floating-badge {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 12px;
  color: #4d6d8d;
  font-size: 11px;
  background: rgb(255 255 255 / 94%);
  border: 1px solid #dceaf6;
  border-radius: 8px;
  box-shadow: 0 12px 26px rgb(42 105 167 / 13%);
}

.floating-badge span {
  color: #318ddd;
  font-size: 14px;
  font-weight: 700;
}

.badge-ai {
  top: 82px;
  right: 6%;
}

.badge-code {
  bottom: 74px;
  left: 6%;
}

.feature-section {
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: 72px;
  padding: 72px 0 20px;
  border-top: 1px solid #e4edf5;
}

.section-eyebrow {
  margin-bottom: 18px;
  color: #8aa1b7;
}

.section-intro h2 {
  margin: 0;
  color: #1b3554;
  font-size: 30px;
  line-height: 1.35;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 26px;
}

.feature-item {
  padding-left: 18px;
  border-left: 1px solid #dbe8f3;
}

.feature-number {
  color: #4a9ae2;
  font-size: 12px;
  font-weight: 700;
}

.feature-item h3 {
  margin: 28px 0 10px;
  color: #294462;
  font-size: 16px;
}

.feature-item p {
  margin: 0;
  color: #7b8ea3;
  font-size: 13px;
  line-height: 1.8;
}

@media (max-width: 1000px) {
  .hero-section {
    grid-template-columns: 1fr;
    padding-top: 24px;
  }

  .hero-copy {
    max-width: 680px;
  }

  .hero-visual {
    min-height: 420px;
  }

  .feature-section {
    gap: 36px;
  }
}

@media (max-width: 700px) {
  .hero-copy h1 {
    font-size: 42px;
  }

  .hero-visual {
    min-height: 340px;
  }

  .main-preview {
    width: 100%;
    transform: translate(-50%, -50%) rotate(-2deg);
  }

  .preview-content {
    padding: 22px 16px;
  }

  .feature-section {
    display: block;
    padding-top: 48px;
  }

  .feature-grid {
    grid-template-columns: 1fr;
    gap: 22px;
    margin-top: 38px;
  }

  .feature-item h3 {
    margin-top: 14px;
  }
}

@media (max-width: 480px) {
  .hero-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .hero-actions button {
    width: 100%;
  }

  .hero-visual {
    min-height: 280px;
  }

  .preview-sidebar {
    flex-basis: 48px;
  }

  .preview-body {
    min-height: 220px;
  }

  .preview-heading small,
  .badge-code {
    display: none;
  }

  .badge-ai {
    top: 18px;
    right: 0;
  }
}
</style>
