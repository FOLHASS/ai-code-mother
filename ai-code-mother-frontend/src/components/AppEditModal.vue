<script setup lang="ts">
import { ref, watch } from 'vue'
import { Input, message, Modal } from 'ant-design-vue'

import { updateApp } from '@/api/appController.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

const props = defineProps<{
  open: boolean
  app: API.AppVO | null
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  saved: [app: API.AppVO]
}>()

const loginUserStore = useLoginUserStore()
const appName = ref('')
const isSaving = ref(false)

watch([() => props.open, () => props.app], ([open]) => {
  if (open) appName.value = props.app?.appName || ''
}, { immediate: true })

const close = () => {
  if (!isSaving.value) emit('update:open', false)
}

const save = async () => {
  const app = props.app
  if (isSaving.value || !app?.id) return
  if (!loginUserStore.loginUser.id || String(app.userId) !== String(loginUserStore.loginUser.id)) {
    message.warning('只能编辑自己的作品')
    return
  }

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
    emit('saved', { ...app, appName: name })
    emit('update:open', false)
    message.success('应用名称已更新')
  } catch {
    message.error('网络异常，应用信息保存失败')
  } finally {
    isSaving.value = false
  }
}
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
