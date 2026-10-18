<script setup lang="ts">
import { Modal } from 'ant-design-vue'
import AppCover from './AppCover.vue'
import type { AppEditModalController } from '../services/AppEditModalController.ts'
import { formatDate } from '@/utils/app.ts'
import { formatCodeGenType } from '@/utils/codeGenTypes.ts'

const props = defineProps<{ open: boolean; controller: AppEditModalController }>()
const { app, form, isAdmin, title, isLoading, loadError, isSaving, load, close, save } =
  props.controller
</script>

<template>
  <Modal
    :open="open"
    :title="title"
    :footer="null"
    width="900px"
    :style="{ maxWidth: 'calc(100vw - 32px)' }"
    :closable="!isSaving"
    :mask-closable="!isSaving"
    :keyboard="!isSaving"
    :destroy-on-close="true"
    @cancel="close"
  >
    <div v-if="isLoading" class="edit-status" role="status" aria-live="polite">
      <span class="loading-spinner"></span>
      <p>正在读取应用信息...</p>
    </div>
    <div v-else-if="loadError" class="edit-status" role="alert">
      <p>{{ loadError }}</p>
      <button class="secondary-button" type="button" @click="load">重新加载</button>
    </div>
    <div v-else-if="app" class="edit-layout">
      <aside class="app-summary">
        <AppCover class="summary-cover" :app="app" size="summary" />
        <h2>{{ app.appName || '未命名应用' }}</h2>
        <p>{{ app.initPrompt || '暂无初始需求' }}</p>
        <dl>
          <div>
            <dt>应用 ID</dt>
            <dd>{{ app.id }}</dd>
          </div>
          <div>
            <dt>创建时间</dt>
            <dd>{{ formatDate(app.createTime) }}</dd>
          </div>
          <div>
            <dt>生成模式</dt>
            <dd>{{ app.codeGenType ? formatCodeGenType(app.codeGenType) : '-' }}</dd>
          </div>
        </dl>
      </aside>
      <form class="edit-panel" @submit.prevent="save">
        <div class="panel-heading">
          <h2>基础信息</h2>
          <p>应用名称会显示在主页卡片和对话页面顶部。</p>
        </div>
        <label class="field-item">
          <span>应用名称 <em>必填</em></span>
          <input
            v-model="form.appName"
            type="text"
            required
            maxlength="50"
            placeholder="请输入应用名称"
            :disabled="isSaving"
          />
        </label>
        <template v-if="isAdmin">
          <label class="field-item">
            <span>封面地址</span>
            <input
              v-model="form.cover"
              type="url"
              placeholder="请输入可访问的图片 URL"
              :disabled="isSaving"
            />
          </label>
          <label class="field-item">
            <span>优先级</span>
            <input
              v-model.number="form.priority"
              type="number"
              required
              min="0"
              step="1"
              :disabled="isSaving"
            />
            <small>设置为 99 后，应用会出现在主页的精选案例中。</small>
          </label>
        </template>
        <div class="form-actions">
          <button class="secondary-button" type="button" :disabled="isSaving" @click="close">
            取消
          </button>
          <button class="save-button" type="submit" :disabled="isSaving || !form.appName.trim()">
            {{ isSaving ? '保存中...' : '保存修改' }}
          </button>
        </div>
      </form>
    </div>
  </Modal>
</template>

<style scoped>
/* 弹窗复用原编辑页的应用摘要与表单，小屏改为单栏并限制内容高度。 */
.edit-layout {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 24px;
  max-height: 70vh;
  margin-top: 20px;
  overflow-y: auto;
  color: #274354;
}

.app-summary {
  padding: 18px;
  background: #f7fbfa;
  border: 1px solid #e3ecef;
  border-radius: 10px;
}

.app-summary h2 {
  margin: 16px 0 7px;
  color: #1c3447;
  font-size: 18px;
  overflow-wrap: anywhere;
}

.app-summary > p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: #8a9ba3;
  font-size: 12px;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.app-summary dl {
  margin: 20px 0 0;
  padding-top: 12px;
  border-top: 1px solid #e3ecef;
}

.app-summary dl div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
  font-size: 12px;
}

.app-summary dt {
  flex-shrink: 0;
  color: #8a9ba3;
}

.app-summary dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
}

.edit-panel {
  min-width: 0;
  padding-right: 2px;
}

.panel-heading {
  padding-bottom: 18px;
  margin-bottom: 22px;
  border-bottom: 1px solid #edf2f3;
}

.panel-heading h2 {
  margin: 0 0 6px;
  color: #1d354a;
  font-size: 18px;
}

.panel-heading p,
.field-item small {
  margin: 0;
  color: #91a0a7;
  font-size: 12px;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.field-item > span {
  color: #56717d;
  font-size: 13px;
  font-weight: 600;
}

.field-item em {
  margin-left: 5px;
  color: #c76f70;
  font-size: 11px;
  font-style: normal;
  font-weight: 400;
}

.field-item input {
  min-height: 42px;
  padding: 0 12px;
  color: #274354;
  font: inherit;
  font-size: 13px;
  background: #fbfdfd;
  border: 1px solid #dce8ea;
  border-radius: 7px;
  outline: 0;
}

.field-item input:focus {
  border-color: #65b9ad;
  box-shadow: 0 0 0 3px rgb(101 185 173 / 12%);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 9px;
}

.secondary-button,
.save-button {
  min-height: 38px;
  padding: 0 16px;
  color: #5f7782;
  font: inherit;
  font-size: 13px;
  background: #fff;
  border: 1px solid #d9e7eb;
  border-radius: 7px;
  cursor: pointer;
}

.save-button {
  color: #fff;
  background: #248f83;
  border-color: #248f83;
}

button:disabled,
input:disabled {
  cursor: wait;
  opacity: 0.55;
}

.edit-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 65px 20px;
  color: #738a96;
  text-align: center;
}

.edit-status p {
  margin: 0;
}

.loading-spinner {
  width: 27px;
  height: 27px;
  border: 3px solid #dfecea;
  border-top-color: #3a9f91;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 680px) {
  .edit-layout {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .app-summary {
    display: grid;
    grid-template-columns: 90px minmax(0, 1fr);
    column-gap: 14px;
  }

  .summary-cover {
    grid-row: span 2;
    height: 90px;
  }

  .app-summary h2 {
    margin-top: 2px;
  }

  .app-summary dl {
    grid-column: 1 / -1;
  }
}
</style>
