<script setup lang="ts">
import UserAvatar from '@/components/UserAvatar.vue'
import { formatDateTime } from '@/utils/app.ts'

type UserRole = 'user' | 'admin' | 'ban'
type UserTableColumnKey =
  'id' | 'user' | 'userAccount' | 'userProfile' | 'userRole' | 'createTime' | 'actions'

type UserTableColumn = {
  key: UserTableColumnKey
  title: string
  className?: string
  cellClassName?: string
}

defineProps<{
  users: API.UserVO[]
  totalUsers: number
  isLoading: boolean
  isDeleting: boolean
  currentPage: number
  pageSize: number
}>()
const emit = defineEmits<{
  edit: [user: API.UserVO]
  delete: [user: API.UserVO]
  'page-change': [page: number]
}>()

const roleLabels: Record<UserRole, string> = {
  user: '普通用户',
  admin: '管理员',
  ban: '已封禁',
}

const userTableColumns: UserTableColumn[] = [
  { key: 'id', title: 'ID', cellClassName: 'id-cell' },
  { key: 'user', title: '用户' },
  { key: 'userAccount', title: '账号' },
  { key: 'userProfile', title: '简介', cellClassName: 'profile-cell' },
  { key: 'userRole', title: '角色' },
  { key: 'createTime', title: '创建时间' },
  {
    key: 'actions',
    title: '操作',
    className: 'action-column',
    cellClassName: 'action-column',
  },
]

const formatRole = (role?: string) => {
  return role && role in roleLabels ? roleLabels[role as UserRole] : '未知角色'
}

const formatDate = (date?: string) => {
  return formatDateTime(date)
}
</script>

<template>
  <section class="table-panel" aria-label="用户列表">
    <div class="table-toolbar">
      <div>
        <h2>用户列表</h2>
        <span>共 {{ totalUsers }} 条记录</span>
      </div>
      <span class="table-hint">仅管理员可修改和删除用户</span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th v-for="column in userTableColumns" :key="column.key" :class="column.className">
              {{ column.title }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading">
            <td :colspan="userTableColumns.length" class="empty-cell">正在加载用户数据...</td>
          </tr>
          <tr v-else-if="users.length === 0">
            <td :colspan="userTableColumns.length" class="empty-cell">暂无符合条件的用户</td>
          </tr>
          <tr v-for="user in users" v-else :key="user.id">
            <td v-for="column in userTableColumns" :key="column.key" :class="column.cellClassName">
              <template v-if="column.key === 'id'"> #{{ user.id }} </template>

              <div v-else-if="column.key === 'user'" class="user-cell">
                <UserAvatar
                  :avatar="user.userAvatar"
                  :name="user.userName || user.userAccount"
                  size="sm"
                />
                <strong>{{ user.userName || '未设置昵称' }}</strong>
              </div>

              <template v-else-if="column.key === 'userAccount'">
                {{ user.userAccount || '-' }}
              </template>

              <template v-else-if="column.key === 'userProfile'">
                {{ user.userProfile || '暂无简介' }}
              </template>

              <span
                v-else-if="column.key === 'userRole'"
                class="role-badge"
                :class="`role-${user.userRole || 'unknown'}`"
              >
                {{ formatRole(user.userRole) }}
              </span>

              <template v-else-if="column.key === 'createTime'">
                {{ formatDate(user.createTime) }}
              </template>

              <div v-else-if="column.key === 'actions'" class="action-buttons">
                <button class="text-action" type="button" @click="emit('edit', user)">编辑</button>
                <button
                  class="text-action danger-action"
                  type="button"
                  :disabled="isDeleting"
                  @click="emit('delete', user)"
                >
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalUsers > pageSize" class="pagination">
      <button
        type="button"
        :disabled="currentPage === 1 || isLoading"
        @click="emit('page-change', currentPage - 1)"
      >
        上一页
      </button>
      <span>第 {{ currentPage }} 页</span>
      <button
        type="button"
        :disabled="currentPage * pageSize >= totalUsers || isLoading"
        @click="emit('page-change', currentPage + 1)"
      >
        下一页
      </button>
    </div>
  </section>
</template>

<style scoped>
.table-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

h2,
p {
  margin-top: 0;
}

.table-panel {
  background: #fff;
  border: 1px solid #e4edf6;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(42 92 145 / 5%);
}

.action-buttons,
.pagination {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination button {
  height: 38px;
  padding: 0 14px;
  font: inherit;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
}

.pagination button {
  color: #52647b;
  background: #fff;
  border: 1px solid #d8e4ef;
}

.pagination button:hover:not(:disabled) {
  color: #2679d9;
  border-color: #8bb8e9;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.table-panel {
  margin-top: 20px;
  overflow: hidden;
}

.table-toolbar {
  align-items: center;
  padding: 20px 20px 16px;
}

.table-toolbar h2 {
  margin-bottom: 4px;
  color: #20334f;
  font-size: 18px;
}

.table-toolbar span,
.table-hint {
  color: #8b99aa;
  font-size: 12px;
}

.table-hint {
  color: #5d8fca;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  text-align: left;
}

th,
td {
  padding: 13px 20px;
  border-top: 1px solid #edf2f7;
  vertical-align: middle;
}

th {
  color: #748499;
  font-size: 12px;
  font-weight: 600;
  background: #fbfdff;
}

td {
  color: #46576c;
  font-size: 13px;
}

.id-cell {
  color: #8a9aab;
  font-variant-numeric: tabular-nums;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 130px;
}

.user-cell strong {
  color: #2b3e55;
  font-weight: 600;
}

.profile-cell {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-badge {
  display: inline-flex;
  padding: 4px 8px;
  font-size: 11px;
  border-radius: 999px;
}

.role-user {
  color: #3478a9;
  background: #edf7ff;
}

.role-admin {
  color: #6e56b4;
  background: #f3efff;
}

.role-ban {
  color: #c04d5f;
  background: #fff0f2;
}

.role-unknown {
  color: #7a8795;
  background: #f1f3f5;
}

.action-column {
  white-space: nowrap;
}

.text-action {
  padding: 4px 0;
  color: #2679d9;
  font: inherit;
  font-size: 13px;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.text-action:hover:not(:disabled) {
  color: #1768c5;
}

.danger-action {
  color: #d94b5b;
}

.danger-action:hover:not(:disabled) {
  color: #b72f41;
}

.empty-cell {
  padding: 60px 20px;
  color: #91a0b1;
  text-align: center;
}

.pagination {
  justify-content: flex-end;
  padding: 16px 20px 20px;
}

.pagination span {
  color: #66778c;
  font-size: 13px;
}

@media (max-width: 700px) {
  .table-toolbar {
    align-items: flex-start;
  }

  .table-hint {
    display: none;
  }
}
</style>
