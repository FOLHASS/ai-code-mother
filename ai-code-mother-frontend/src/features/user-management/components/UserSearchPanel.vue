<script setup lang="ts">
import type { UserQuery } from '@/shared/domain/models.ts'
/**
 * 用户搜索面板：持有未提交的筛选草稿，只通过 search/reset 事件通知页面。
 * 父级持有真正生效的查询条件和请求状态；修改输入不会立即请求，点击查询才提交草稿副本。
 * 模板按 ID、昵称、账号、简介和角色展示字段，布局在不同断点逐步减少列数。
 */
import { reactive } from 'vue'

// 加载态由父级传入，用于查询按钮的文案与禁用反馈。
defineProps<{ isLoading: boolean }>()
// search 携带完整筛选草稿，reset 无参数，通知父级清空已应用条件并重新查询。
const emit = defineEmits<{ search: [query: UserQuery]; reset: [] }>()
// 本地草稿与父级 appliedQuery 相互独立，避免输入过程中影响当前分页结果。
const draftQuery = reactive<UserQuery>({
  id: undefined,
  userName: '',
  userAccount: '',
  userProfile: '',
  userRole: undefined,
})
// 发送浅拷贝，父级应用查询条件时不会继续引用本组件的响应式草稿对象。
/** 应用当前检索条件并从第一页重新查询。 */
const search = () => emit('search', { ...draftQuery })
/**
 * 先将输入恢复为空条件，再通知父级执行对应的查询状态重置。
 * 角色使用 undefined 表示“全部角色”，与具体角色字符串区分。
 */
const reset = () => {
  Object.assign(draftQuery, {
    id: undefined,
    userName: '',
    userAccount: '',
    userProfile: '',
    userRole: undefined,
  })
  emit('reset')
}
</script>

<template>
  <section class="query-panel" aria-label="用户查询条件">
    <div class="query-grid">
      <label class="field-item">
        <span>ID</span>
        <input v-model="draftQuery.id" type="text" inputmode="numeric" placeholder="用户 ID" />
      </label>
      <label class="field-item">
        <span>用户昵称</span>
        <input v-model="draftQuery.userName" type="text" placeholder="输入昵称" />
      </label>
      <label class="field-item">
        <span>账号</span>
        <input v-model="draftQuery.userAccount" type="text" placeholder="输入账号" />
      </label>
      <label class="field-item">
        <span>简介</span>
        <input v-model="draftQuery.userProfile" type="text" placeholder="输入简介关键词" />
      </label>
      <label class="field-item">
        <span>用户角色</span>
        <select v-model="draftQuery.userRole">
          <option :value="undefined">全部角色</option>
          <option value="user">普通用户</option>
          <option value="admin">管理员</option>
          <option value="ban">已封禁</option>
        </select>
      </label>
    </div>
    <div class="query-actions">
      <button class="secondary-button" type="button" @click="reset">重置</button>
      <button class="primary-button" type="button" :disabled="isLoading" @click="search">
        {{ isLoading ? '查询中...' : '查询用户' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
/* 查询区域沿用后台卡片样式，与下方表格分离成独立视觉模块。 */
.query-panel {
  background: #fff;
  border: 1px solid #e4edf6;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(42 92 145 / 5%);
}

.query-panel {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding: 20px;
}

/* 宽屏五个条件横向排列，每列具有最小宽度，操作按钮保持独立宽度。 */
.query-grid {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(5, minmax(120px, 1fr));
  gap: 14px;
}

.field-item {
  display: block;
}

.field-item > span {
  display: block;
  margin-bottom: 7px;
  color: #52647b;
  font-size: 12px;
  font-weight: 600;
}

.field-item input,
.field-item select,
.field-item textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 9px 10px;
  color: #24364c;
  font: inherit;
  background: #fbfdff;
  border: 1px solid #d8e4ef;
  border-radius: 6px;
  outline: none;
}

.field-item input,
.field-item select {
  height: 38px;
}

.field-item textarea {
  resize: vertical;
}

.field-item input:focus,
.field-item select:focus,
.field-item textarea:focus {
  border-color: #4a91e8;
  box-shadow: 0 0 0 3px rgb(74 145 232 / 11%);
}

.query-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.query-actions {
  flex: 0 0 auto;
}

.primary-button,
.secondary-button {
  height: 38px;
  padding: 0 14px;
  font: inherit;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
}

.primary-button {
  color: #fff;
  background: var(--color-brand);
  border: 1px solid var(--color-brand);
}

.secondary-button {
  color: #52647b;
  background: #fff;
  border: 1px solid #d8e4ef;
}

.primary-button:hover:not(:disabled) {
  background: #1768c5;
}

.secondary-button:hover {
  color: var(--color-brand);
  border-color: #8bb8e9;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.field-item em {
  margin-left: 4px;
  color: #d94b5b;
  font-size: 11px;
  font-style: normal;
  font-weight: 400;
}

/* 中等屏幕条件改三列，并将操作区移至下一行右侧。 */
@media (max-width: 1100px) {
  .query-panel {
    display: block;
  }

  .query-grid {
    grid-template-columns: repeat(3, minmax(150px, 1fr));
  }

  .query-actions {
    justify-content: flex-end;
    margin-top: 16px;
  }
}

/* 较窄屏幕使用两列输入，minmax(0, 1fr) 允许字段随容器收缩。 */
@media (max-width: 700px) {
  .query-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* 手机条件逐项纵向排列，重置与查询按钮均分一行。 */
@media (max-width: 480px) {
  .query-grid {
    grid-template-columns: 1fr;
  }

  .query-actions {
    justify-content: stretch;
  }

  .query-actions button {
    flex: 1;
  }
}
</style>
