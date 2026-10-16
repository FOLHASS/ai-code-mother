<script setup lang="ts">
import { computed } from 'vue'
import { Alert, Tooltip } from 'ant-design-vue'

import type { ElementInfo } from '@/utils/visualEditor.ts'

const props = defineProps<{
  modelValue: string
  isLoadingApp: boolean
  isStreaming: boolean
  isLoggedIn: boolean
  canInteract: boolean
  historyLoaded: boolean
  canVisualEdit: boolean
  isEditMode: boolean
  selectedElement: ElementInfo | null
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  'toggle-edit': []
  'clear-selection': []
}>()
const input = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    emit('send')
  }
}
</script>

<template>
  <Tooltip
    :title="!isLoadingApp && !canInteract ? '无法在别人的作品下对话哦~' : undefined"
    placement="top"
  >
    <form
      :class="{ 'chat-composer--readonly': !canInteract }"
      class="chat-composer"
      @submit.prevent="emit('send')"
    >
      <Alert
        v-if="selectedElement"
        class="selected-element"
        type="info"
        show-icon
        closable
        @close="emit('clear-selection')"
      >
        <template #message>
          <span>已选中元素</span>
          <code class="element-selector">{{ selectedElement.selector }}</code>
        </template>
        <template #description>
          <span class="element-page">{{ selectedElement.pagePath }}</span>
          <span v-if="selectedElement.textContent" class="element-text">{{
            selectedElement.textContent
          }}</span>
        </template>
      </Alert>
      <textarea
        v-model="input"
        :disabled="isLoadingApp || isStreaming || !isLoggedIn || !canInteract || !historyLoaded"
        :placeholder="
          canInteract
            ? '描述更详细，页面会更具体。按 Enter 发送，Shift + Enter 换行'
            : '当前为只读预览，仅应用创建者可以继续对话'
        "
        rows="3"
        @keydown="handleKeydown"
      ></textarea>
      <div class="composer-footer">
        <span>{{
          isStreaming ? 'AI 正在生成，请稍候...' : canInteract ? '支持连续对话迭代' : '只读查看'
        }}</span>
        <div class="composer-actions">
          <Tooltip
            :title="
              canVisualEdit
                ? '在右侧网站上点击选择需要修改的元素'
                : '网站预览就绪后，应用创建者可进行可视化编辑'
            "
          >
            <button
              :aria-pressed="isEditMode"
              :class="{ 'edit-button--active': isEditMode }"
              :disabled="!canVisualEdit"
              class="edit-button"
              type="button"
              @click="emit('toggle-edit')"
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M12 7v10m-5-5h10" />
              </svg>
              {{ isEditMode ? '退出编辑' : '编辑' }}
            </button>
          </Tooltip>
          <button
            :disabled="
              isLoadingApp || isStreaming || !input.trim() || !canInteract || !historyLoaded
            "
            aria-label="发送消息"
            class="send-button"
            type="submit"
          >
            <span aria-hidden="true">↑</span>
          </button>
        </div>
      </div>
    </form>
  </Tooltip>
</template>

<style scoped>
.chat-composer {
  margin: 0 18px 18px;
  padding: 12px 13px 10px;
  background: #fbfdfd;
  border: 1px solid #dfeaec;
  border-radius: 12px;
}
.chat-composer textarea {
  display: block;
  width: 100%;
  padding: 0;
  color: #304d5b;
  font: inherit;
  font-size: 13px;
  line-height: 1.55;
  background: transparent;
  border: 0;
  outline: 0;
  resize: none;
}
.chat-composer textarea::placeholder {
  color: #a6b2b8;
}
.selected-element {
  margin-bottom: 12px;
}
.element-selector {
  margin-left: 8px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.element-page,
.element-text {
  display: block;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.element-text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.chat-composer--readonly {
  cursor: not-allowed;
}
.chat-composer--readonly textarea {
  pointer-events: none;
}
.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
  color: #9aabb2;
  font-size: 10px;
}
.composer-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 9px;
}
.edit-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 10px;
  color: #607985;
  font: inherit;
  font-size: 12px;
  background: #fff;
  border: 1px solid #dfeaec;
  border-radius: 8px;
  cursor: pointer;
}
.edit-button--active {
  color: #1b70c9;
  background: #eaf4ff;
  border-color: #8fc2f5;
}
.composer-footer .send-button {
  display: grid;
  width: 32px;
  height: 32px;
  color: #fff;
  font-size: 20px;
  place-items: center;
  background: #819196;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}
.composer-footer button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
</style>
