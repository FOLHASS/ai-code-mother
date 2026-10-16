<script setup lang="ts">
/**
 * 登录页：维护登录表单、提交状态和错误提示；认证成功后把用户资料写入全局登录 store。
 * 页面使用 AuthPageShell 的 form/footer 插槽，表单提交统一经过 handleSubmit；布局样式由外壳组件提供。
 * 输入期间只修改本页草稿，只有后端确认成功后才更新其他页面共享的用户身份。
 */
import { computed, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useRoute, useRouter } from 'vue-router'

import { login } from '@/api/userController.ts'
import AuthPageShell from '@/components/AuthPageShell.vue'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

// 读取 redirect 查询参数，并使用路由实例完成登录后的页面跳转。
const route = useRoute()
const router = useRouter()
const loginUserStore = useLoginUserStore()

// 登录请求草稿：账号通过模板的 trim 修饰符去除首尾空格，密码保留用户原始输入。
const formState = reactive<API.UserLoginRequest>({
  userAccount: '',
  userPassword: '',
})
// 请求期间禁用账号、密码和提交按钮；错误内容由本页渲染为可访问的 alert 文本。
const isSubmitting = ref(false)
const loginError = ref('')

/**
 * 按当前实现读取字符串类型且以 / 开头的 redirect；缺少参数或类型不符时返回首页。
 * 登录和注册使用相同的取值规则，便于从受保护页面返回原位置。
 */
const redirectPath = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
})

/**
 * 提交登录表单，无参数、无业务返回值，通过响应式状态反馈结果。
 * 先清空旧错误并检查必填项，再发起请求；业务失败和网络异常分别给出提示。
 * 成功时更新共享登录状态，然后跳转；finally 确保成功、失败和提前返回都结束加载状态。
 */
const handleSubmit = async () => {
  loginError.value = ''

  if (!formState.userAccount || !formState.userPassword) {
    loginError.value = '请输入账号和密码'
    return
  }

  isSubmitting.value = true

  try {
    const response = await login(formState)

    // 只有业务状态成功且存在用户资料时，才将响应视为登录成功。
    if (response.data.code !== 0 || !response.data.data) {
      loginError.value = response.data.message || '登录失败，请检查账号和密码'
      return
    }

    // 共享 store 是全站登录资料的状态来源，更新后菜单和个人资料等消费者会同步刷新。
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
