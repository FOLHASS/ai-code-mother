<script setup lang="ts">
import { reactive } from 'vue'

defineProps<{ isLoading: boolean }>()
const emit = defineEmits<{ search: [query: API.UserQueryRequest]; reset: [] }>()
const draftQuery = reactive<API.UserQueryRequest>({
  id: undefined,
  userName: '',
  userAccount: '',
  userProfile: '',
  userRole: undefined,
})
const search = () => emit('search', { ...draftQuery })
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
        <input v-model.number="draftQuery.id" type="number" min="1" placeholder="用户 ID" />
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
  background: #2679d9;
  border: 1px solid #2679d9;
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
  color: #2679d9;
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

@media (max-width: 700px) {
  .query-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

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
