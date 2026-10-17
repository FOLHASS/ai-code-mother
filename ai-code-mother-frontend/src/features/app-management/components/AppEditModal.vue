<script setup lang="ts">
import { Input, Modal } from 'ant-design-vue'
import type { AppEditModalController } from '../services/AppEditModalController.ts'
const props = defineProps<{ open: boolean; controller: AppEditModalController }>()
const { appName, isSaving, close, save } = props.controller
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
