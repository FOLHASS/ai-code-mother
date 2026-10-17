<script lang="ts" setup>
/**
 * 应用对话页的布局入口：连接顶部应用操作、左侧对话、右侧预览三个业务区域。
 * 会话和删除操作由类控制器与服务负责；此处只组装组件并绑定它们公开的状态与命令。
 * 子组件通过事件上报操作，展示组件不直接依赖路由或接口。
 */
import { useAppChatSession } from '@/app/controllers.ts'
import { ChatConversationPanel } from '@/features/ai-chat/components'

import { AppChatHeader } from '@/features/app-workbench/components'
import { AppPreviewPanel } from '@/features/app-workbench/components'

// 从同一个会话实例取得响应式状态；模板自动解包 ref，所有区域共享一致的应用与生成状态。
const session = useAppChatSession()
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
} = session
const removeApp = session.removeApp
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
      <ChatConversationPanel
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
/* 页面占满视口并禁止外层滚动；桌面下两个面板分别管理自己的可滚动内容。 */
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  color: #20364f;
  background: #f6f9fb;
}
/* minmax 与 min-height: 0 允许内容收缩，避免长消息或 iframe 将整个页面撑高。 */
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
/* 窄屏改为上下排列，工作区承担整体滚动，并保留每个面板的最小可用高度。 */
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
