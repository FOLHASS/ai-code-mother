<script setup lang="ts">
import AuthPageShell from '@/components/AuthPageShell.vue'
import { useRegisterController } from '@/app/controllers.ts'

const controller = useRegisterController()
const { form: formState, isSubmitting, error: registerError, submit: handleSubmit } = controller
</script>

<template>
  <AuthPageShell
    heading-id="register-title"
    intro-kicker="START BUILDING TODAY"
    intro-title="从一句话开始，构建你的应用。"
    intro-description="创建账号，解锁 AI 应用生成能力，把复杂的开发流程变成清晰、简单的创作体验。"
    :intro-points="['自然语言驱动', '快速生成应用', '持续迭代优化']"
    card-eyebrow="CREATE ACCOUNT"
    card-title="创建账号"
    card-description="加入平台，开始你的 AI 应用创作。"
    form-label="用户注册"
  >
    <template #form>
      <form class="auth-form" @submit.prevent="handleSubmit">
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

        <label class="field-label field-label-spaced" for="register-check-password">确认密码</label>
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
    </template>

    <template #footer>
      <p class="auth-footer">
        已有账号？
        <RouterLink to="/user/login">返回登录</RouterLink>
      </p>
    </template>
  </AuthPageShell>
</template>
