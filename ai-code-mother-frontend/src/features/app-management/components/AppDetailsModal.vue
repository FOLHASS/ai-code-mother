<script setup lang="ts">
import type { AppInfo } from '@/shared/domain/models.ts'
/**
 * 应用详情展示弹窗：直接消费父级传入的 VO，展示概览、元数据、初始需求及三个底部操作。
 * 不在弹窗内部加载数据或判断权限；父级管理详情来源以及查看、编辑的实际处理方式。
 */
import { Modal } from 'ant-design-vue'

import AppCover from './AppCover.vue'
import { formatDate } from '@/utils/app.ts'
import { formatCodeGenType } from '@/utils/codeGenTypes.ts'

// open 配合父级 v-model 管理显隐；没有 app 时不渲染详情主体，避免读取空对象字段。
defineProps<{
  open: boolean
  app: AppInfo | null
}>()

// 关闭只更新 open；查看与编辑携带当前 app，由父级决定路由或弹窗，不复制导航逻辑。
const emit = defineEmits<{
  'update:open': [open: boolean]
  openApp: [app: AppInfo]
  editApp: [app: AppInfo]
}>()
// 模板按封面/作者概览 → 双列元数据 → 保留换行的初始需求 → 操作区排列。
// priority === 99 同时控制精选封面配色与徽标；deployKey 的存在仅用于展示部署状态。
// codeGenType 与时间继续复用公共格式化函数，不直接将接口枚举值作为最终展示名称。
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
        <div>
          <dt>应用 ID</dt>
          <dd>{{ app.id || '-' }}</dd>
        </div>
        <div>
          <dt>生成模式</dt>
          <dd>{{ app.codeGenType ? formatCodeGenType(app.codeGenType) : '-' }}</dd>
        </div>
        <div>
          <dt>创建时间</dt>
          <dd>{{ formatDate(app.createTime) }}</dd>
        </div>
        <div>
          <dt>部署状态</dt>
          <dd>{{ app.deployKey ? '已部署' : '未部署' }}</dd>
        </div>
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

/* 概览横向并排封面与应用身份，封面尺寸由 AppCover 的 modal 模式统一管理。 */
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

/* 元数据采用两列栅格，每项内部标签与值左右分布，支持较短信息快速对照。 */
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

/* 初始需求使用 pre-wrap 保留用户换行，仍允许长段落按弹窗宽度正常折行。 */
.app-details__prompt p {
  margin: 8px 0 0;
  color: #526975;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}

/* 操作区靠右排列，通过主色按钮突出查看入口，其余操作保持次级按钮样式。 */
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

/* 窄屏概览改竖向，元数据改为一列，底部按钮允许换行以避免水平溢出。 */
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
