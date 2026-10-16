<script setup lang="ts">
/**
 * 注册页：持有账号、密码、确认密码草稿，执行本地校验并调用注册接口。
 * 注册成功后返回登录页并携带 redirect，不在本页设置登录身份；表单与页脚复用认证外壳插槽。
 * 模板的原生 submit.prevent 阻止浏览器整页提交，提交状态用于锁定输入和按钮。
 */
import { computed, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useRoute, useRouter } from 'vue-router'

import { register } from '@/api/userController.ts'
import AuthPageShell from '@/components/AuthPageShell.vue'

const route = useRoute()
const router = useRouter()
// 请求草稿只在当前注册页存在；checkPassword 用于前端一致性校验并随请求交由后端处理。
const formState = reactive<API.UserRegisterRequest>({
  userAccount: '',
  userPassword: '',
  checkPassword: '',
})
// 提交状态与错误提示相互独立：校验不通过时只更新错误，不进入网络加载状态。
const isSubmitting = ref(false)
const registerError = ref('')

/**
 * 沿用登录页的 redirect 规则：仅保留字符串且以 / 开头的值，其余情况回退到首页。
 * 该值会传给登录页，由后续登录流程使用。
 */
const redirectPath = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
})

/**
 * 检查当前表单并返回第一条错误文案；返回空字符串表示本地校验通过。
 * 账号先去空格再校验 4–20 个字符；密码按原始输入校验 8–20 个字符并与确认密码比较。
 * 这些检查用于及时反馈，最终的账号合法性和注册权限仍由接口判定。
 */
const validateForm = () => {
  const account = formState.userAccount?.trim() || ''
  const password = formState.userPassword || ''
  const checkPassword = formState.checkPassword || ''

  if (!account || !password || !checkPassword) return '请完整填写注册信息'
  if (account.length < 4 || account.length > 20) return '账号长度需为 4-20 个字符'
  if (password.length < 8 || password.length > 20) return '密码长度需为 8-20 个字符'
  if (password !== checkPassword) return '两次输入的密码不一致'
  return ''
}

/**
 * 完成“校验草稿 → 提交注册 → 提示成功 → 返回登录”的异步流程。
 * 请求参数显式列出三个注册字段，避免把页面状态混入接口；网络和业务失败保留用户输入便于重试。
 */
const handleSubmit = async () => {
  registerError.value = validateForm()
  if (registerError.value) return

  isSubmitting.value = true
  try {
    const response = await register({
      userAccount: formState.userAccount?.trim(),
      userPassword: formState.userPassword,
      checkPassword: formState.checkPassword,
    })

    if (response.data.code !== 0) {
      registerError.value = response.data.message || '注册失败，请稍后重试'
      return
    }

    // 注册接口成功仅代表账号创建完成，当前流程要求用户再执行登录。
    message.success('注册成功，请登录')
    await router.push({ path: '/user/login', query: { redirect: redirectPath.value } })
  } catch {
    registerError.value = '网络异常，请稍后重试'
  // 无论业务返回、跳转结果或异常如何，都会恢复提交按钮的可用状态。
  } finally {
    isSubmitting.value = false
  }
}
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
