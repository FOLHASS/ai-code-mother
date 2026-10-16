<script setup lang="ts">
/**
 * “我的作品”名称编辑弹窗：仅通过用户更新接口修改名称，不编辑封面或优先级。
 * 父级持有显隐和待编辑应用，本组件持有名称草稿及保存状态，成功后回传更新后的应用。
 */
import { ref, watch } from 'vue'
import { Input, message, Modal } from 'ant-design-vue'

import { updateApp } from '@/api/appController.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

// open 由父级 v-model 控制，app 是用于回填和校验创建者的原始快照；本组件不直接修改 props。
const props = defineProps<{
  open: boolean
  app: API.AppVO | null
}>()

// update:open 通知父级关闭；saved 用新对象同步列表名称，避免为了单字段更新额外读取详情。
const emit = defineEmits<{
  'update:open': [open: boolean]
  saved: [app: API.AppVO]
}>()

const loginUserStore = useLoginUserStore()
// 草稿与应用对象分离：取消关闭后不会改变列表，再次打开时重新从当前应用名称回填。
const appName = ref('')
// 保存状态统一控制确认按钮加载、输入禁用及所有关闭入口，防止请求中重复保存或意外关闭。
const isSaving = ref(false)

// 打开弹窗或切换被编辑对象时同步名称；immediate 兼容组件首次创建时已经处于打开状态。
watch([() => props.open, () => props.app], ([open]) => {
  if (open) appName.value = props.app?.appName || ''
}, { immediate: true })

// 仅空闲时向父级发出关闭事件，与模板上的遮罩、键盘和关闭按钮禁用规则保持一致。
const close = () => {
  if (!isSaving.value) emit('update:open', false)
}

/** 防重复提交、检查作品归属及非空名称后保存；业务失败保留弹窗和草稿，方便用户修改或重试。 */
const save = async () => {
  const app = props.app
  if (isSaving.value || !app?.id) return
  // 即使从其他入口误传入应用也会再次检查本人权限；管理员在此仍按“我的作品”规则处理。
  if (!loginUserStore.loginUser.id || String(app.userId) !== String(loginUserStore.loginUser.id)) {
    message.warning('只能编辑自己的作品')
    return
  }

  // 仅去掉首尾空白，不更改用户输入中的内容；前端先拦截纯空白名称，后端仍执行最终校验。
  const name = appName.value.trim()
  if (!name) {
    message.warning('请输入应用名称')
    return
  }

  isSaving.value = true
  try {
    // 我的作品只修改名称，包括管理员自己的作品。
    const response = await updateApp({ id: app.id, appName: name })
    if (response.data.code !== 0 || !response.data.data) {
      message.error(response.data.message || '应用信息保存失败')
      return
    }
    // 先报告更新结果再关闭弹窗，父级可即时同步卡片；保留原 VO 中作者、封面等其他字段。
    emit('saved', { ...app, appName: name })
    emit('update:open', false)
    message.success('应用名称已更新')
  } catch {
    message.error('网络异常，应用信息保存失败')
  // 正常返回、业务错误和网络异常都释放保存锁，避免弹窗永久保持禁用状态。
  } finally {
    isSaving.value = false
  }
}
// 模板中的原生 form 与 Modal 确认事件复用同一个 save，回车提交也遵循相同校验和防重入规则。
</script>

<template>
  <Modal
    :open="open"
    title="编辑我的作品"
    ok-text="保存修改"
    cancel-text="取消"
    :width="480"
    :confirm-loading="isSaving"
    :ok-button-props="{ disabled: !appName.trim() }"
    :cancel-button-props="{ disabled: isSaving }"
    :closable="!isSaving"
    :mask-closable="!isSaving"
    :keyboard="!isSaving"
    @ok="save"
    @cancel="close"
  >
    <form class="app-edit-form" @submit.prevent="save">
      <label for="app-edit-name">应用名称</label>
      <Input
        id="app-edit-name"
        v-model:value="appName"
        :maxlength="50"
        :disabled="isSaving"
        placeholder="请输入应用名称"
        autocomplete="off"
      />
      <p>名称会显示在作品卡片和对话页面顶部。</p>
    </form>
  </Modal>
</template>

<style scoped>
/* 弹窗主体只包含名称输入与用途说明，表单留白和字体与独立编辑页保持同一视觉风格。 */
.app-edit-form {
  padding: 8px 0 4px;
}

.app-edit-form label {
  display: block;
  margin-bottom: 8px;
  color: #56717d;
  font-size: 13px;
  font-weight: 600;
}

.app-edit-form p {
  margin: 10px 0 0;
  color: #91a0a7;
  font-size: 12px;
}
</style>
