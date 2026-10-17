<script setup lang="ts">
/**
 * 应用信息编辑页：管理员可维护名称、封面和优先级，普通用户只能修改本人应用名称。
 * 左侧摘要展示读取到的应用，右侧表单保存可编辑副本；保存成功后跳往对应业务入口。
 */
import { AppCover } from '@/features/app-management/components'
import PageHeader from '@/components/PageHeader.vue'
import { useAppEditController } from '@/app/controllers.ts'
import { formatDate } from '@/utils/app.ts'
import { formatCodeGenType } from '@/utils/codeGenTypes.ts'
const controller = useAppEditController()
const { router, app, isLoading, isSaving, form, isAdmin, pageTitle, save } = controller
</script>

<template>
  <section class="app-edit-page">
    <div v-if="isLoading" class="edit-loading">
      <span></span>
      <p>正在读取应用信息...</p>
    </div>
    <template v-else-if="app">
      <PageHeader
        eyebrow="APP SETTINGS"
        :title="pageTitle"
        description="修改应用的基础信息，保存后立即生效。"
        tone="teal"
      >
        <template #actions
          ><button class="back-button" type="button" @click="router.back()">
            返回上一页
          </button></template
        >
      </PageHeader>
      <div class="edit-layout">
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
            <div>
              <h2>基础信息</h2>
              <p>应用名称会显示在主页卡片和对话页面顶部。</p>
            </div>
            <span>{{ isAdmin ? 'ADMIN EDIT' : 'MY APP' }}</span>
          </div>
          <label class="field-item"
            ><span>应用名称 <em>必填</em></span
            ><input
              v-model="form.appName"
              type="text"
              maxlength="50"
              placeholder="请输入应用名称"
              :disabled="isSaving"
          /></label>
          <template v-if="isAdmin">
            <label class="field-item"
              ><span>封面地址</span
              ><input
                v-model="form.cover"
                type="url"
                placeholder="请输入可访问的图片 URL"
                :disabled="isSaving"
            /></label>
            <label class="field-item"
              ><span>优先级</span
              ><input
                v-model.number="form.priority"
                type="number"
                min="0"
                placeholder="优先级为 99 时进入精选"
                :disabled="isSaving"
              /><small>设置为 99 后，应用会出现在主页的精选案例中。</small></label
            >
          </template>
          <div class="form-actions">
            <button class="cancel-button" type="button" :disabled="isSaving" @click="router.back()">
              取消</button
            ><button class="save-button" type="submit" :disabled="isSaving">
              {{ isSaving ? '保存中...' : '保存修改' }}
            </button>
          </div>
        </form>
      </div>
    </template>
  </section>
</template>

<style scoped>
/* 编辑页限制内容宽度；桌面采用左侧 290px 摘要与右侧自适应表单的两栏布局。 */
.app-edit-page {
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
  color: var(--color-text-primary);
}
/* 摘要截断较长的初始需求，表单聚焦时突出边框；保存期间使用禁用态表达进行中的操作。
 * 同一条既有样式行包含布局、摘要、字段、操作区及加载动画，保持原有选择器和顺序不变。
 */
.back-button,
.cancel-button {
  min-height: 37px;
  padding: 0 14px;
  color: #5f7782;
  font: inherit;
  font-size: 13px;
  background: #fff;
  border: 1px solid #d9e7eb;
  border-radius: 7px;
  cursor: pointer;
}
.edit-layout {
  display: grid;
  grid-template-columns: 290px minmax(0, 1fr);
  gap: 20px;
}
.app-summary,
.edit-panel {
  background: #fff;
  border: 1px solid #e3ecef;
  border-radius: 12px;
  box-shadow: 0 8px 25px rgb(43 91 104 / 5%);
}
.app-summary {
  padding: 22px;
}
.app-summary h2 {
  margin: 17px 0 7px;
  color: #1c3447;
  font-size: 19px;
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
  margin: 22px 0 0;
  padding-top: 14px;
  border-top: 1px solid #edf2f3;
}
.app-summary dl div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 9px;
  font-size: 12px;
}
.app-summary dt {
  color: #a0adb2;
}
.app-summary dd {
  margin: 0;
  color: #54717c;
  text-align: right;
}
.edit-panel {
  padding: 27px 30px;
}
.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 21px;
  margin-bottom: 24px;
  border-bottom: 1px solid #edf2f3;
}
.panel-heading h2 {
  margin: 0 0 6px;
  color: #1d354a;
  font-size: 20px;
}
.panel-heading p {
  margin: 0;
  color: #91a0a7;
  font-size: 12px;
}
.panel-heading > span {
  color: #a1afb4;
  font-size: 10px;
  letter-spacing: 0.14em;
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
.field-item small {
  color: #a0adb1;
  font-size: 11px;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 9px;
}
.save-button {
  min-height: 38px;
  padding: 0 18px;
  color: #fff;
  font: inherit;
  font-size: 13px;
  background: #248f83;
  border: 0;
  border-radius: 7px;
  cursor: pointer;
}
.save-button:disabled,
.cancel-button:disabled,
.back-button:disabled {
  cursor: wait;
  opacity: 0.55;
}
.edit-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100px 20px;
  color: #91a2a8;
}
.edit-loading span {
  width: 27px;
  height: 27px;
  margin-bottom: 14px;
  border: 3px solid #dfecea;
  border-top-color: #3a9f91;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.edit-loading p {
  margin: 0;
  font-size: 13px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
/* 窄屏改为单栏，摘要内部用封面与文字小网格排列，详情信息和编辑表单获得完整行宽。 */
@media (max-width: 700px) {
  .edit-layout {
    grid-template-columns: 1fr;
  }
  .app-summary {
    display: grid;
    grid-template-columns: 100px 1fr;
    column-gap: 15px;
  }
  .summary-cover {
    grid-row: span 3;
    height: 100px;
  }
  .app-summary h2 {
    margin-top: 5px;
  }
  .app-summary dl {
    grid-column: 1 / -1;
  }
  .edit-panel {
    padding: 22px 18px;
  }
}
</style>
