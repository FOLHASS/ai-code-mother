<script setup lang="ts">
import { Modal } from 'ant-design-vue'

import AppCover from '@/components/AppCover.vue'
import { formatDate } from '@/utils/app.ts'

defineProps<{
  open: boolean
  app: API.AppVO | null
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  openApp: [app: API.AppVO]
  editApp: [app: API.AppVO]
}>()
</script>

<template>
  <Modal
    :open="open"
    :title="app?.appName || '应用详情'"
    :footer="null"
    width="620px"
    @cancel="emit('update:open', false)"
  >
    <div v-if="app" class="app-details">
      <div class="app-details__overview">
        <AppCover :app="app" size="modal" :featured="app.priority === 99" />
        <div class="app-details__identity">
          <h2>{{ app.appName || '未命名应用' }}</h2>
          <p>{{ app.user?.userName || 'NoCode 创作者' }}</p>
          <span v-if="app.priority === 99" class="app-details__badge">精选应用</span>
        </div>
      </div>

      <dl class="app-details__meta">
        <div><dt>应用 ID</dt><dd>{{ app.id || '-' }}</dd></div>
        <div><dt>生成模式</dt><dd>{{ app.codeGenType || '-' }}</dd></div>
        <div><dt>创建时间</dt><dd>{{ formatDate(app.createTime) }}</dd></div>
        <div><dt>部署状态</dt><dd>{{ app.deployKey ? '已部署' : '未部署' }}</dd></div>
      </dl>

      <div class="app-details__prompt">
        <span>初始需求</span>
        <p>{{ app.initPrompt || '暂无初始需求' }}</p>
      </div>

      <div class="app-details__actions">
        <button type="button" @click="emit('update:open', false)">关闭</button>
        <button type="button" @click="emit('editApp', app)">编辑应用</button>
        <button class="primary-action" type="button" @click="emit('openApp', app)">查看应用</button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.app-details {
  color: #334c5e;
}

.app-details__overview {
  display: flex;
  align-items: center;
  gap: 18px;
}

.app-details__identity h2 {
  margin: 0 0 7px;
  color: #1c3447;
  font-size: 21px;
}

.app-details__identity p {
  margin: 0 0 10px;
  color: #8a9ba3;
  font-size: 13px;
}

.app-details__badge {
  display: inline-flex;
  padding: 5px 8px;
  color: #826120;
  font-size: 11px;
  background: #fff3cf;
  border-radius: 999px;
}

.app-details__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 22px;
  margin: 24px 0 0;
  padding: 16px 0;
  border-top: 1px solid #edf2f3;
  border-bottom: 1px solid #edf2f3;
}

.app-details__meta div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.app-details__meta dt {
  color: #9aa8ae;
}

.app-details__meta dd {
  margin: 0;
  color: #526f7b;
  text-align: right;
}

.app-details__prompt {
  margin-top: 18px;
}

.app-details__prompt > span {
  color: #72878f;
  font-size: 12px;
  font-weight: 600;
}

.app-details__prompt p {
  margin: 8px 0 0;
  color: #526975;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.app-details__actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 25px;
}

.app-details__actions button {
  min-height: 35px;
  padding: 0 13px;
  color: #58747f;
  font: inherit;
  font-size: 12px;
  background: #fff;
  border: 1px solid #d8e5e8;
  border-radius: 6px;
  cursor: pointer;
}

.app-details__actions .primary-action {
  color: #fff;
  background: #248f83;
  border-color: #248f83;
}

@media (max-width: 560px) {
  .app-details__overview {
    align-items: flex-start;
    flex-direction: column;
  }

  .app-details__meta {
    grid-template-columns: 1fr;
  }

  .app-details__actions {
    flex-wrap: wrap;
  }
}
</style>
