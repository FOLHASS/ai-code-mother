<script setup lang="ts">
/**
 * 只读用户表格与分页区域：所有数据、页码和加载态都由父级提供。
 * 编辑、删除和翻页均通过 Emits 发出，不在表格中请求接口或直接改动列表。
 * 列定义统一驱动表头与单元格；内容区按列键选择头像、文本、角色和操作按钮的渲染方式。
 * 加载中、空列表和正常记录互斥展示，分页在总数超过单页容量时出现。
 */
import UserAvatar from '@/components/UserAvatar.vue'
import { formatDateTime } from '@/utils/app.ts'

// 角色键仅用于显示映射；表格不以文案或样式承担权限验证。
type UserRole = 'user' | 'admin' | 'ban'
// 列键使用字面量联合，防止列配置与模板分支使用不同拼写。
type UserTableColumnKey =
  'id' | 'user' | 'userAccount' | 'userProfile' | 'userRole' | 'createTime' | 'actions'

/**
 * 表格列的展示配置：className 应用于表头，cellClassName 应用于对应数据单元格。
 */
type UserTableColumn = {
  key: UserTableColumnKey
  title: string
  className?: string
  cellClassName?: string
}

// 列表和分页为单向数据流；isDeleting 控制所有删除按钮，避免同一删除流程中重复操作。
defineProps<{
  users: API.UserVO[]
  // 后端返回的总记录数，用于统计、分页显示和下一页是否可用的判断。
  totalUsers: number
  isLoading: boolean
  isDeleting: boolean
  // 从 1 开始的当前页，页码修改交由父级处理。
  currentPage: number
  pageSize: number
}>()
// 操作事件携带完整用户对象以便回填或确认；分页事件仅携带目标页码。
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

// 表头与每一行按同一列数组顺序渲染；加载与空态的 colspan 同样使用列数。
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

/**
 * 将已知角色转成中文；缺少或未识别的角色返回“未知角色”，便于管理时发现异常数据。
 */
const formatRole = (role?: string) => {
  return role && role in roleLabels ? roleLabels[role as UserRole] : '未知角色'
}

/**
 * 把接口时间交给共享日期工具格式化，缺省值沿用工具默认占位。
 */
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

/* 操作区与分页区共享右对齐布局；前后页按钮状态由模板根据页码、总数和加载态判断。 */
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

/* 表格在窄视口允许横向滚动，保留各列的可读宽度而不挤压字段。 */
.table-wrap {
  overflow-x: auto;
}

/* 表格最小宽度用于承载七列管理信息，溢出由外层滚动容器处理。 */
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

/* 简介过长时单行省略，避免单条记录拉宽表格。 */
.profile-cell {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 角色徽标共享基础形状，具体角色类只负责颜色区分。 */
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

/* 编辑与删除保持同一行，避免操作列因文字换行变得难以点击。 */
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

/* 窄屏隐藏辅助权限提示，优先为统计标题和表格操作保留空间。 */
@media (max-width: 700px) {
  .table-toolbar {
    align-items: flex-start;
  }

  .table-hint {
    display: none;
  }
}
</style>
