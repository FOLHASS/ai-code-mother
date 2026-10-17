<script setup lang="ts">
import AuthPageShell from '@/components/AuthPageShell.vue'
import { useLoginController } from '@/app/controllers.ts'

const controller = useLoginController()
const { form: formState, isSubmitting, error: loginError, submit: handleSubmit } = controller
</script>

<template>
  <AuthPageShell
    heading-id="login-title"
    intro-kicker="BUILD WITH INTELLIGENCE"
    intro-title="让想法，快速成为可用的应用。"
    intro-description="从自然语言出发，用 AI 简化应用构建流程，让每一次创意都能更快落地。"
    intro-status="AI 应用引擎已就绪"
    card-eyebrow="WELCOME BACK"
    card-title="登录平台"
    card-description="登录后继续你的应用创作。"
    form-label="用户登录"
  >
    <template #form>
      <form class="auth-form" @submit.prevent="handleSubmit">
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
    </template>

    <template #footer>
      <p class="auth-footer">
        还没有账号？
        <RouterLink to="/user/register">立即注册</RouterLink>
      </p>
    </template>
  </AuthPageShell>
</template>
