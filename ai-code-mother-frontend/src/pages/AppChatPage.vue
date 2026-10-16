<script lang="ts" setup>
/**
 * 应用对话页的布局入口：连接顶部应用操作、左侧对话、右侧预览三个业务区域。
 * 会话状态、历史加载、流式生成及可视化编辑由 useAppChat 协调；此处只组装组件与删除确认流程。
 * 子组件通过事件上报操作，页面再调用组合式函数，避免展示组件直接依赖路由或接口。
 */
import { message, Modal } from 'ant-design-vue'

import { deleteApp } from '@/modules/app-management/api/appApi.ts'
import ChatConversationPanel from '@/modules/ai-chat/components/ChatConversationPanel.vue'
import { asApiLongId } from '@/utils/id.ts'

import AppChatHeader from './app-chat/components/AppChatHeader.vue'
import AppPreviewPanel from './app-chat/components/AppPreviewPanel.vue'
import { useAppChatSession } from '@/modules/app-workbench/composables/useAppChatSession.ts'

// 从同一个会话实例取得响应式状态；模板自动解包 ref，所有区域共享一致的应用与生成状态。
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
} = useAppChatSession()

/**
 * 仅应用创建者且当前未生成时允许发起删除；确认框中快照保存 ID 与名称。
 * 接口成功后用 replace 返回首页，防止浏览器后退再次进入已删除应用。
 * 确认框负责等待异步 onOk；业务失败和网络失败分别使用现有提示。
 */
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
      // 只在用户确认后发请求，雪花 ID 转换由专用适配器保留原字符串精度。
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
