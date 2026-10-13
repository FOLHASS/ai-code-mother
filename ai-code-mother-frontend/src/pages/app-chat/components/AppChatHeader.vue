<script setup lang="ts">
import { DownloadOutlined, DownOutlined } from '@ant-design/icons-vue'
import { Popover } from 'ant-design-vue'
import { ref, watch } from 'vue'

import AppInfoPanel from './AppInfoPanel.vue'

import logoUrl from '@/assets/logo.png'

const props = defineProps<{
  app: API.AppVO | null
  title: string
  deployedUrl: string
  hasApp: boolean
  isLoadingApp: boolean
  isStreaming: boolean
  isDownloading: boolean
  isDeploying: boolean
  canInteract: boolean
  previewUrl: string
}>()

const emit = defineEmits<{
  back: []
  'open-deployed': []
  download: []
  deploy: []
  delete: []
}>()

const isInfoOpen = ref(false)
const requestDelete = () => {
  isInfoOpen.value = false
  emit('delete')
}
watch(
  () => props.app?.id,
  () => {
    isInfoOpen.value = false
  },
)
</script>

<template>
  <header class="chat-header">
    <button aria-label="返回首页" class="back-button" type="button" @click="emit('back')">←</button>
    <div class="chat-brand">
      <img :src="logoUrl" alt="" />
      <div class="chat-brand__text">
        <Popover v-model:open="isInfoOpen" placement="bottomLeft" :trigger="['click']">
          <button
            class="chat-brand__trigger"
            type="button"
            :disabled="!app"
            :aria-expanded="isInfoOpen"
            aria-haspopup="dialog"
            aria-label="查看应用详情"
          >
            <strong>{{ title }}</strong
            ><DownOutlined aria-hidden="true" />
          </button>
          <template #content>
            <AppInfoPanel
              v-if="app"
              :app="app"
              :deployed-url="deployedUrl"
              :can-delete="canInteract && !isStreaming"
              @delete="requestDelete"
            />
          </template>
        </Popover>
        <span>AI 应用生成工作台</span>
      </div>
    </div>
    <div class="header-actions">
      <button v-if="deployedUrl" class="deployed-link" type="button" @click="emit('open-deployed')">
        打开网站 ↗
      </button>
      <button
        :disabled="isLoadingApp || isStreaming || isDownloading || !hasApp || !canInteract"
        class="download-button"
        type="button"
        @click="emit('download')"
      >
        <DownloadOutlined />{{ isDownloading ? '下载中...' : '下载代码' }}
      </button>
      <button
        :disabled="isDeploying || isStreaming || !previewUrl || !canInteract"
        class="deploy-button"
        type="button"
        @click="emit('deploy')"
      >
        <span aria-hidden="true">◈</span>{{ isDeploying ? '部署中...' : '部署' }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.chat-header {
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 70px;
  padding: 0 28px;
  background: #fff;
  border-bottom: 1px solid #e7eef2;
}
.back-button {
  width: 35px;
  height: 35px;
  color: #54717b;
  font-size: 22px;
  background: #f5fafb;
  border: 1px solid #e3edef;
  border-radius: 9px;
  cursor: pointer;
}
.chat-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.chat-brand img {
  width: 34px;
  height: 34px;
  border-radius: 10px;
}
.chat-brand__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.chat-brand__trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: min(38vw, 320px);
  padding: 0;
  color: #1b3144;
  font: inherit;
  font-size: 15px;
  background: none;
  border: 0;
  cursor: pointer;
}
.chat-brand__trigger:hover:not(:disabled) {
  color: #198979;
}
.chat-brand__trigger:disabled {
  cursor: default;
}
.chat-brand__trigger strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-brand__trigger :deep(.anticon) {
  flex: 0 0 auto;
  padding: 6px;
  font-size: 10px;
  background: #f4f7f9;
  border-radius: 6px;
}
.chat-brand__text > span {
  color: #9baab2;
  font-size: 11px;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}
.deployed-link {
  color: #198979;
  font: inherit;
  font-size: 12px;
  background: none;
  border: 0;
  cursor: pointer;
}
.download-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 0 14px;
  color: #245e62;
  font: inherit;
  font-size: 13px;
  background: #fff;
  border: 1px solid #b8d6d5;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}
.download-button:hover:not(:disabled) {
  background: #f0faf7;
}
.download-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.deploy-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 0 16px;
  color: #fff;
  font: inherit;
  font-size: 13px;
  background: #1b2733;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}
.deploy-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
@media (max-width: 560px) {
  .chat-header {
    padding: 0 14px;
    gap: 10px;
    flex-wrap: wrap;
    padding-bottom: 10px;
  }
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
  .chat-brand__text > span {
    display: none;
  }
  .deployed-link {
    display: none;
  }
}
</style>
