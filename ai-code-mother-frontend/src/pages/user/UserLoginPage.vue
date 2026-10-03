<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useRoute, useRouter } from 'vue-router'

import logoUrl from '@/assets/logo.png'
import { login } from '@/api/userController.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

const route = useRoute()
const router = useRouter()
const loginUserStore = useLoginUserStore()

const formState = reactive<API.UserLoginRequest>({
  userAccount: '',
  userPassword: '',
})
const isSubmitting = ref(false)
const loginError = ref('')

const redirectPath = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
})

const handleSubmit = async () => {
  loginError.value = ''

  if (!formState.userAccount || !formState.userPassword) {
    loginError.value = '请输入账号和密码'
    return
  }

  isSubmitting.value = true

  try {
    const response = await login(formState)

    if (response.data.code !== 0 || !response.data.data) {
      loginError.value = response.data.message || '登录失败，请检查账号和密码'
      return
    }

    loginUserStore.setLoginUser(response.data.data)
    message.success('登录成功')
    await router.push(redirectPath.value)
  } catch {
    loginError.value = '网络异常，请稍后重试'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-intro" aria-labelledby="login-title">
      <div class="intro-grid" aria-hidden="true"></div>
      <div class="intro-content">
        <div class="intro-brand">
          <img class="intro-logo" :src="logoUrl" alt="" />
          <span>AI 零代码应用生成平台</span>
        </div>
        <p class="intro-kicker">BUILD WITH INTELLIGENCE</p>
        <h1 id="login-title">让想法，快速成为可用的应用。</h1>
        <p class="intro-description">
          从自然语言出发，用 AI 简化应用构建流程，让每一次创意都能更快落地。
        </p>
        <div class="intro-status" aria-label="平台状态">
          <span class="status-dot"></span>
          <span>AI 应用引擎已就绪</span>
        </div>
      </div>
    </section>

    <section class="login-panel" aria-label="用户登录">
      <div class="login-card">
        <div class="card-heading">
          <p class="card-eyebrow">WELCOME BACK</p>
          <h2>登录平台</h2>
          <p>登录后继续你的应用创作。</p>
        </div>

        <form class="login-form" @submit.prevent="handleSubmit">
          <label class="field-label" for="user-account">账号</label>
          <input
            id="user-account"
            v-model.trim="formState.userAccount"
            class="field-input"
            type="text"
            name="userAccount"
            autocomplete="username"
            placeholder="请输入账号"
            :disabled="isSubmitting"
          />

          <div class="password-label-row">
            <label class="field-label" for="user-password">密码</label>
            <button class="text-button" type="button">忘记密码？</button>
          </div>
          <input
            id="user-password"
            v-model="formState.userPassword"
            class="field-input"
            type="password"
            name="userPassword"
            autocomplete="current-password"
            placeholder="请输入密码"
            :disabled="isSubmitting"
          />

          <p v-if="loginError" class="error-message" role="alert">{{ loginError }}</p>

          <button class="submit-button" type="submit" :disabled="isSubmitting">
            <span>{{ isSubmitting ? '登录中...' : '登录' }}</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <p class="register-tip">
          还没有账号？
          <RouterLink to="/user/register">立即注册</RouterLink>
        </p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(420px, 0.9fr);
  min-height: calc(100vh - 65px);
  background: #f7faff;
}

.login-intro {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 600px;
  padding: 72px clamp(40px, 8vw, 128px);
  overflow: hidden;
  background: linear-gradient(135deg, #eef6ff 0%, #f9fcff 62%, #fff 100%);
}

.intro-grid {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  background-image: linear-gradient(#dcecff 1px, transparent 1px),
    linear-gradient(90deg, #dcecff 1px, transparent 1px);
  background-position: center;
  background-size: 44px 44px;
  mask-image: linear-gradient(135deg, black 0%, transparent 72%);
}

.intro-content {
  position: relative;
  z-index: 1;
  max-width: 560px;
}

.intro-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #20334f;
  font-size: 15px;
  font-weight: 600;
}

.intro-logo {
  width: 34px;
  height: 34px;
  object-fit: contain;
  border-radius: 9px;
  box-shadow: 0 8px 18px rgb(55 126 220 / 16%);
}

.intro-kicker,
.card-eyebrow {
  margin: 0;
  color: #3478d4;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.intro-kicker {
  margin-top: 78px;
}

.intro-content h1 {
  max-width: 520px;
  margin: 18px 0 20px;
  color: #14243b;
  font-size: clamp(36px, 4.2vw, 60px);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.18;
}

.intro-description {
  max-width: 430px;
  margin: 0;
  color: #60718b;
  font-size: 16px;
  line-height: 1.8;
}

.intro-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 44px;
  padding: 8px 12px;
  color: #48709d;
  font-size: 13px;
  background: rgb(255 255 255 / 72%);
  border: 1px solid #dcecff;
  border-radius: 999px;
}

.status-dot {
  width: 7px;
  height: 7px;
  background: #2fc48d;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgb(47 196 141 / 12%);
}

.login-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 56px clamp(24px, 6vw, 96px);
  background: #fff;
}

.login-card {
  width: min(100%, 400px);
}

.card-heading h2 {
  margin: 12px 0 8px;
  color: #182940;
  font-size: 30px;
  font-weight: 650;
  line-height: 1.3;
}

.card-heading > p:last-child {
  margin: 0;
  color: #8492a6;
  font-size: 14px;
}

.login-form {
  margin-top: 38px;
}

.field-label {
  display: block;
  margin-bottom: 9px;
  color: #3b4c64;
  font-size: 13px;
  font-weight: 600;
}

.password-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 22px;
}

.password-label-row .field-label {
  margin-bottom: 9px;
}

.field-input {
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

.field-input::placeholder {
  color: #a9b6c6;
}

.field-input:focus {
  background: #fff;
  border-color: #4a91e8;
  box-shadow: 0 0 0 3px rgb(74 145 232 / 12%);
}

.field-input:disabled,
.submit-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.text-button {
  padding: 0;
  color: #5d8fca;
  font: inherit;
  font-size: 12px;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.text-button:hover {
  color: #246fc1;
}

.error-message {
  margin: 14px 0 0;
  color: #d94b5b;
  font-size: 13px;
}

.submit-button {
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

.submit-button:hover:not(:disabled) {
  background: #1768c5;
  box-shadow: 0 12px 24px rgb(38 121 217 / 24%);
  transform: translateY(-1px);
}

.register-tip {
  margin: 26px 0 0;
  color: #8492a6;
  font-size: 13px;
  text-align: center;
}

.register-tip a {
  color: #2679d9;
  font-weight: 600;
  text-decoration: none;
}

.register-tip a:hover {
  text-decoration: underline;
}

@media (max-width: 900px) {
  .login-page {
    grid-template-columns: 1fr;
  }

  .login-intro {
    min-height: auto;
    padding: 56px 32px 48px;
  }

  .intro-kicker {
    margin-top: 48px;
  }

  .intro-content h1 {
    font-size: clamp(34px, 7vw, 48px);
  }

  .login-panel {
    padding: 52px 24px 72px;
  }
}

@media (max-width: 480px) {
  .login-intro {
    padding: 40px 20px 36px;
  }

  .intro-content h1 {
    margin-top: 14px;
    font-size: 34px;
  }

  .intro-description {
    font-size: 14px;
  }

  .intro-status {
    margin-top: 30px;
  }

  .login-panel {
    padding: 40px 20px 56px;
  }
}
</style>
