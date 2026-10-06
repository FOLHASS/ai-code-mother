<script setup lang="ts">
import logoUrl from '@/assets/logo.png'

defineProps<{
  headingId: string
  introKicker: string
  introTitle: string
  introDescription: string
  introStatus?: string
  introPoints?: string[]
  cardEyebrow: string
  cardTitle: string
  cardDescription: string
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

.auth-page-shell__grid {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  background-image: linear-gradient(#dcecff 1px, transparent 1px),
    linear-gradient(90deg, #dcecff 1px, transparent 1px);
  background-position: center;
  background-size: 44px 44px;
  mask-image: linear-gradient(135deg, black 0%, transparent 72%);
}

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
  transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
}

.auth-page-shell :deep(.field-input::placeholder) {
  color: #a9b6c6;
}

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
  background: #2679d9;
  border: 0;
  border-radius: 8px;
  box-shadow: 0 10px 20px rgb(38 121 217 / 18%);
  cursor: pointer;
  transition: background-color 0.2s, transform 0.2s, box-shadow 0.2s;
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
  color: #2679d9;
  font-weight: 600;
  text-decoration: none;
}

.auth-page-shell :deep(.auth-footer a:hover) {
  text-decoration: underline;
}

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
