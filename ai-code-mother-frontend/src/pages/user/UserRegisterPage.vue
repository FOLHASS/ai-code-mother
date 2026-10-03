<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useRoute, useRouter } from 'vue-router'

import logoUrl from '@/assets/logo.png'
import { register } from '@/api/userController.ts'

const route = useRoute()
const router = useRouter()
const formState = reactive<API.UserRegisterRequest>({
  userAccount: '',
  userPassword: '',
  checkPassword: '',
})
const isSubmitting = ref(false)
const registerError = ref('')

const redirectPath = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
})

const validateForm = () => {
  const account = formState.userAccount?.trim() || ''
  const password = formState.userPassword || ''
  const checkPassword = formState.checkPassword || ''

  if (!account || !password || !checkPassword) {
    return '请完整填写注册信息'
  }

  if (account.length < 4 || account.length > 20) {
    return '账号长度需为 4-20 个字符'
  }

  if (password.length < 8 || password.length > 20) {
    return '密码长度需为 8-20 个字符'
  }

  if (password !== checkPassword) {
    return '两次输入的密码不一致'
  }

  return ''
}

const handleSubmit = async () => {
  registerError.value = validateForm()
  if (registerError.value) {
    return
  }

  isSubmitting.value = true

  try {
    const registerResponse = await register({
      userAccount: formState.userAccount?.trim(),
      userPassword: formState.userPassword,
      checkPassword: formState.checkPassword,
    })

    if (registerResponse.data.code !== 0) {
      registerError.value = registerResponse.data.message || '注册失败，请稍后重试'
      return
    }

    message.success('注册成功，请登录')
    await router.push({
      path: '/user/login',
      query: { redirect: redirectPath.value },
    })
  } catch {
    registerError.value = '网络异常，请稍后重试'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="register-page">
    <section class="register-intro" aria-labelledby="register-title">
      <div class="intro-grid" aria-hidden="true"></div>
      <div class="intro-content">
        <div class="intro-brand">
          <img class="intro-logo" :src="logoUrl" alt="" />
          <span>AI 零代码应用生成平台</span>
        </div>
        <p class="intro-kicker">START BUILDING TODAY</p>
        <h1 id="register-title">从一句话开始，构建你的应用。</h1>
        <p class="intro-description">
          创建账号，解锁 AI 应用生成能力，把复杂的开发流程变成清晰、简单的创作体验。
        </p>
        <div class="intro-points" aria-label="平台能力">
          <span>自然语言驱动</span>
          <span>快速生成应用</span>
          <span>持续迭代优化</span>
        </div>
      </div>
    </section>

    <section class="register-panel" aria-label="用户注册">
      <div class="register-card">
        <div class="card-heading">
          <p class="card-eyebrow">CREATE ACCOUNT</p>
          <h2>创建账号</h2>
          <p>加入平台，开始你的 AI 应用创作。</p>
        </div>

        <form class="register-form" @submit.prevent="handleSubmit">
          <label class="field-label" for="register-account">账号</label>
          <input
            id="register-account"
            v-model.trim="formState.userAccount"
            class="field-input"
            type="text"
            name="userAccount"
            autocomplete="username"
            placeholder="请输入 4-20 位账号"
            :disabled="isSubmitting"
          />

          <label class="field-label field-label-spaced" for="register-password">密码</label>
          <input
            id="register-password"
            v-model="formState.userPassword"
            class="field-input"
            type="password"
            name="userPassword"
            autocomplete="new-password"
            placeholder="请输入 8-20 位密码"
            :disabled="isSubmitting"
          />

          <label class="field-label field-label-spaced" for="register-check-password">
            确认密码
          </label>
          <input
            id="register-check-password"
            v-model="formState.checkPassword"
            class="field-input"
            type="password"
            name="checkPassword"
            autocomplete="new-password"
            placeholder="请再次输入密码"
            :disabled="isSubmitting"
          />

          <p v-if="registerError" class="error-message" role="alert">{{ registerError }}</p>

          <button class="submit-button" type="submit" :disabled="isSubmitting">
            <span>{{ isSubmitting ? '创建中...' : '创建账号' }}</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <p class="login-tip">
          已有账号？
          <RouterLink to="/user/login">返回登录</RouterLink>
        </p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.register-page {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(420px, 0.9fr);
  min-height: 100vh;
  background: #f7faff;
}

.register-intro {
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
  line-height: 1.18;
}

.intro-description {
  max-width: 440px;
  margin: 0;
  color: #60718b;
  font-size: 16px;
  line-height: 1.8;
}

.intro-points {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 40px;
}

.intro-points span {
  padding: 8px 11px;
  color: #48709d;
  font-size: 12px;
  background: rgb(255 255 255 / 72%);
  border: 1px solid #dcecff;
  border-radius: 999px;
}

.register-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 56px clamp(24px, 6vw, 96px);
  background: #fff;
}

.register-card {
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

.register-form {
  margin-top: 34px;
}

.field-label {
  display: block;
  margin-bottom: 9px;
  color: #3b4c64;
  font-size: 13px;
  font-weight: 600;
}

.field-label-spaced {
  margin-top: 20px;
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

.login-tip {
  margin: 26px 0 0;
  color: #8492a6;
  font-size: 13px;
  text-align: center;
}

.login-tip a {
  color: #2679d9;
  font-weight: 600;
  text-decoration: none;
}

.login-tip a:hover {
  text-decoration: underline;
}

@media (max-width: 900px) {
  .register-page {
    grid-template-columns: 1fr;
  }

  .register-intro {
    min-height: auto;
    padding: 56px 32px 48px;
  }

  .intro-kicker {
    margin-top: 48px;
  }

  .intro-content h1 {
    font-size: clamp(34px, 7vw, 48px);
  }

  .register-panel {
    padding: 52px 24px 72px;
  }
}

@media (max-width: 480px) {
  .register-intro {
    padding: 40px 20px 36px;
  }

  .intro-content h1 {
    margin-top: 14px;
    font-size: 34px;
  }

  .intro-description {
    font-size: 14px;
  }

  .register-panel {
    padding: 40px 20px 56px;
  }
}
</style>
