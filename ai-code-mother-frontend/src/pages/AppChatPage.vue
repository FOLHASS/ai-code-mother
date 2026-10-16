<script lang="ts" setup>
import { message, Modal } from 'ant-design-vue'

import { deleteApp } from '@/api/appController.ts'
import { asApiLongId } from '@/utils/id.ts'

import AppChatHeader from './app-chat/components/AppChatHeader.vue'
import AppConversationPanel from './app-chat/components/AppConversationPanel.vue'
import AppPreviewPanel from './app-chat/components/AppPreviewPanel.vue'
import { useAppChat } from './app-chat/composables/useAppChat.ts'

const {
  router,
  app,
  messages,
  input,
  isEditMode,
  selectedElement,
  canVisualEdit,
  setPreviewIframe,
  toggleEditMode,
  clearSelection,
  isLoadingApp,
  isStreaming,
  isDeploying,
  isDownloading,
  previewUrl,
  previewError,
  deployedUrl,
  setMessageList,
  hasGeneratedWebsite,
  isLoadingHistory,
  historyLoaded,
  historyError,
  hasMoreHistory,
  appTitle,
  isLoggedIn,
  canInteract,
  canReadHistory,
  userMessageLabel,
  showPreview,
  loadHistory,
  retryHistory,
  sendMessage,
  handleDeploy,
  handleDownload,
  openDeployUrl,
} = useAppChat()

const removeApp = () => {
  if (!app.value?.id || !canInteract.value || isStreaming.value) return
  const appId = String(app.value.id)
  const appName = app.value.appName || '未命名应用'
  Modal.confirm({
    title: '删除这个应用？',
    content: `删除后将无法恢复“${appName}”。`,
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        const response = await deleteApp({ id: asApiLongId(appId) })
        if (response.data.code !== 0 || !response.data.data) {
          message.error(response.data.message || '应用删除失败')
          return
        }
        message.success('应用已删除')
        await router.replace('/')
      } catch {
        message.error('网络异常，应用删除失败')
      }
    },
  })
}
</script>

<template>
  <main class="chat-page">
    <AppChatHeader
      :app="app"
      :title="appTitle"
      :deployed-url="deployedUrl"
      :has-app="Boolean(app?.id)"
      :is-loading-app="isLoadingApp"
      :is-streaming="isStreaming"
      :is-downloading="isDownloading"
      :is-deploying="isDeploying"
      :can-interact="canInteract"
      :preview-url="previewUrl"
      @back="router.push('/')"
      @open-deployed="openDeployUrl"
      @download="handleDownload"
      @deploy="handleDeploy"
      @delete="removeApp"
    />

    <div class="chat-workspace">
      <AppConversationPanel
        v-model="input"
        :messages="messages"
        :is-loading-app="isLoadingApp"
        :is-loading-history="isLoadingHistory"
        :history-error="historyError"
        :history-loaded="historyLoaded"
        :has-more-history="hasMoreHistory"
        :is-streaming="isStreaming"
        :is-logged-in="isLoggedIn"
        :can-interact="canInteract"
        :can-read-history="canReadHistory"
        :user-message-label="userMessageLabel"
        :can-visual-edit="canVisualEdit"
        :is-edit-mode="isEditMode"
        :selected-element="selectedElement"
        @list-ready="setMessageList"
        @retry-history="retryHistory"
        @load-history="loadHistory(true)"
        @send="sendMessage()"
        @toggle-edit="toggleEditMode"
        @clear-selection="clearSelection"
      />

      <AppPreviewPanel
        :code-gen-type="app?.codeGenType"
        :has-app="Boolean(app)"
        :has-generated-website="hasGeneratedWebsite"
        :preview-url="previewUrl"
        :preview-error="previewError"
        :is-streaming="isStreaming"
        :is-edit-mode="isEditMode"
        @refresh="showPreview(true)"
        @iframe-ready="setPreviewIframe"
      />
    </div>
  </main>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  color: #20364f;
  background: #f6f9fb;
}
.chat-workspace {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(360px, 0.82fr) minmax(450px, 1.18fr);
  gap: 18px;
  min-height: 0;
  padding: 20px;
  overflow: hidden;
}
.conversation-panel,
.preview-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e5edf0;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgb(34 77 99 / 4%);
}
@media (max-width: 900px) {
  .chat-workspace {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
  .conversation-panel,
  .preview-panel {
    min-height: 520px;
  }
}
@media (max-width: 560px) {
  .chat-workspace {
    padding: 10px;
  }
}
</style>
