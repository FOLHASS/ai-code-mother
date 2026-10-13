<script setup lang="ts">
import { computed } from 'vue'
import { Tooltip } from 'ant-design-vue'

const props = defineProps<{
  modelValue: string
  isLoadingApp: boolean
  isStreaming: boolean
  isLoggedIn: boolean
  canInteract: boolean
  historyLoaded: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
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
        }}</span
        ><button
          :disabled="isLoadingApp || isStreaming || !input.trim() || !canInteract || !historyLoaded"
          type="submit"
        >
          <span aria-hidden="true">↑</span>
        </button>
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
.composer-footer button {
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
