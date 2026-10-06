<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useRouter } from 'vue-router'

import {
  addUser,
  deleteUser,
  getUserVoList,
  updateUser,
} from '@/api/userController.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

type UserRole = 'user' | 'admin' | 'ban'
type UserTableColumnKey =
  | 'id'
  | 'user'
  | 'userAccount'
  | 'userProfile'
  | 'userRole'
  | 'createTime'
  | 'actions'

type UserTableColumn = {
  key: UserTableColumnKey
  title: string
  className?: string
  cellClassName?: string
}

const router = useRouter()
const loginUserStore = useLoginUserStore()
const isLoading = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const isCreating = ref(false)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const currentPage = ref(1)
const pageSize = 10
const totalUsers = ref(0)
const users = ref<API.UserVO[]>([])

const queryForm = reactive<API.UserQueryRequest>({
  id: undefined,
  userName: '',
  userAccount: '',
  userProfile: '',
  userRole: undefined,
})

const editForm = reactive<API.UserUpdateRequest>({})
const createForm = reactive<API.UserAddRequest>({
  userAccount: '',
  userName: '',
  userAvatar: '',
  userProfile: '',
  userRole: 'user',
})

const isAdmin = computed(() => loginUserStore.loginUser.userRole === 'admin')

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
  if (!date) return '-'
  const parsedDate = new Date(date)
  return Number.isNaN(parsedDate.getTime()) ? date : parsedDate.toLocaleString('zh-CN')
}

const loadUsers = async () => {
  if (!isAdmin.value) {
    await router.replace('/')
    return
  }

  isLoading.value = true
  try {
    const response = await getUserVoList({
      ...queryForm,
      id: queryForm.id || undefined,
      userName: queryForm.userName?.trim() || undefined,
      userAccount: queryForm.userAccount?.trim() || undefined,
      userProfile: queryForm.userProfile?.trim() || undefined,
      pageNum: currentPage.value,
      pageSize,
    })

    if (response.data.code !== 0) {
      message.error(response.data.message || '用户列表加载失败')
      return
    }

    users.value = response.data.data?.records || []
    totalUsers.value = response.data.data?.totalRow || 0
  } catch {
    message.error('网络异常，用户列表加载失败')
  } finally {
    isLoading.value = false
  }
}

const handleSearch = async () => {
  currentPage.value = 1
  await loadUsers()
}

const handleReset = async () => {
  queryForm.id = undefined
  queryForm.userName = ''
  queryForm.userAccount = ''
  queryForm.userProfile = ''
  queryForm.userRole = undefined
  await handleSearch()
}

const handlePageChange = async (page: number) => {
  currentPage.value = page
  await loadUsers()
}

const openEditModal = (user: API.UserVO) => {
  Object.assign(editForm, {
    id: user.id,
    userName: user.userName || '',
    userAvatar: user.userAvatar || '',
    userProfile: user.userProfile || '',
    userRole: user.userRole || 'user',
  })
  showEditModal.value = true
}

const openCreateModal = () => {
  Object.assign(createForm, {
    userAccount: '',
    userName: '',
    userAvatar: '',
    userProfile: '',
    userRole: 'user',
  })
  showCreateModal.value = true
}

const closeCreateModal = () => {
  if (!isCreating.value) {
    showCreateModal.value = false
  }
}

const handleCreateUser = async () => {
  const userAccount = createForm.userAccount?.trim() || ''
  if (!userAccount) {
    message.warning('请填写用户账号')
    return
  }

  isCreating.value = true
  try {
    const response = await addUser({
      ...createForm,
      userAccount,
      userName: createForm.userName?.trim() || undefined,
      userAvatar: createForm.userAvatar?.trim() || undefined,
      userProfile: createForm.userProfile?.trim() || undefined,
    })

    if (response.data.code !== 0 || !response.data.data) {
      message.error(response.data.message || '用户创建失败')
      return
    }

    message.success('用户创建成功')
    showCreateModal.value = false
    currentPage.value = 1
    await loadUsers()
  } catch {
    message.error('网络异常，用户创建失败')
  } finally {
    isCreating.value = false
  }
}

const closeEditModal = () => {
  if (!isSaving.value) {
    showEditModal.value = false
  }
}

const handleSaveUser = async () => {
  if (!editForm.id || !editForm.userName?.trim()) {
    message.warning('请填写用户昵称')
    return
  }

  isSaving.value = true
  try {
    const response = await updateUser({
      ...editForm,
      userName: editForm.userName.trim(),
      userProfile: editForm.userProfile?.trim(),
    })

    if (response.data.code !== 0 || !response.data.data) {
      message.error(response.data.message || '用户信息更新失败')
      return
    }

    message.success('用户信息已更新')
    showEditModal.value = false
    await loadUsers()
  } catch {
    message.error('网络异常，用户信息更新失败')
  } finally {
    isSaving.value = false
  }
}

const handleDeleteUser = (user: API.UserVO) => {
  if (!user.id) return

  Modal.confirm({
    title: '确认删除用户？',
    content: `删除后将无法恢复用户“${user.userName || user.userAccount || user.id}”。`,
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      isDeleting.value = true
      try {
        const response = await deleteUser({ id: user.id })
        if (response.data.code !== 0 || !response.data.data) {
          message.error(response.data.message || '用户删除失败')
          return
        }

        message.success('用户已删除')
        if (users.value.length === 1 && currentPage.value > 1) {
          currentPage.value -= 1
        }
        await loadUsers()
      } catch {
        message.error('网络异常，用户删除失败')
      } finally {
        isDeleting.value = false
      }
    },
  })
}

onMounted(() => {
  void loadUsers()
})
</script>

<template>
  <section v-if="isAdmin" class="user-manage-page">
    <header class="page-header">
      <div>
        <p class="page-eyebrow">ADMIN CONSOLE</p>
        <h1>用户管理</h1>
        <p>集中查看和维护平台用户信息。</p>
      </div>
      <div class="header-actions">
        <div class="header-stat">
          <strong>{{ totalUsers }}</strong>
          <span>用户总数</span>
        </div>
        <button class="primary-button create-button" type="button" @click="openCreateModal">
          <span aria-hidden="true">＋</span>
          创建用户
        </button>
      </div>
    </header>

    <section class="query-panel" aria-label="用户查询条件">
      <div class="query-grid">
        <label class="field-item">
          <span>ID</span>
          <input v-model.number="queryForm.id" type="number" min="1" placeholder="用户 ID" />
        </label>
        <label class="field-item">
          <span>用户昵称</span>
          <input v-model="queryForm.userName" type="text" placeholder="输入昵称" />
        </label>
        <label class="field-item">
          <span>账号</span>
          <input v-model="queryForm.userAccount" type="text" placeholder="输入账号" />
        </label>
        <label class="field-item">
          <span>简介</span>
          <input v-model="queryForm.userProfile" type="text" placeholder="输入简介关键词" />
        </label>
        <label class="field-item">
          <span>用户角色</span>
          <select v-model="queryForm.userRole">
            <option :value="undefined">全部角色</option>
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
            <option value="ban">已封禁</option>
          </select>
        </label>
      </div>
      <div class="query-actions">
        <button class="secondary-button" type="button" @click="handleReset">重置</button>
        <button class="primary-button" type="button" :disabled="isLoading" @click="handleSearch">
          {{ isLoading ? '查询中...' : '查询用户' }}
        </button>
      </div>
    </section>

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
              <th
                v-for="column in userTableColumns"
                :key="column.key"
                :class="column.className"
              >
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
              <td
                v-for="column in userTableColumns"
                :key="column.key"
                :class="column.cellClassName"
              >
                <template v-if="column.key === 'id'"> #{{ user.id }} </template>

                <div v-else-if="column.key === 'user'" class="user-cell">
                  <img
                    v-if="user.userAvatar"
                    :src="user.userAvatar"
                    :alt="user.userName || '用户头像'"
                  />
                  <span v-else class="avatar-fallback">{{ (user.userName || '用').slice(0, 1) }}</span>
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
                  <button class="text-action" type="button" @click="openEditModal(user)">编辑</button>
                  <button
                    class="text-action danger-action"
                    type="button"
                    :disabled="isDeleting"
                    @click="handleDeleteUser(user)"
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
        <button type="button" :disabled="currentPage === 1 || isLoading" @click="handlePageChange(currentPage - 1)">上一页</button>
        <span>第 {{ currentPage }} 页</span>
        <button type="button" :disabled="currentPage * pageSize >= totalUsers || isLoading" @click="handlePageChange(currentPage + 1)">下一页</button>
      </div>
    </section>

    <Modal
      v-model:open="showCreateModal"
      title="创建用户"
      :confirm-loading="isCreating"
      ok-text="创建用户"
      cancel-text="取消"
      @ok="handleCreateUser"
      @cancel="closeCreateModal"
    >
      <div class="edit-form">
        <label class="field-item">
          <span>账号 <em>必填</em></span>
          <input v-model="createForm.userAccount" type="text" placeholder="请输入用户账号" />
        </label>
        <label class="field-item">
          <span>用户昵称</span>
          <input v-model="createForm.userName" type="text" placeholder="请输入用户昵称" />
        </label>
        <label class="field-item">
          <span>头像地址</span>
          <input v-model="createForm.userAvatar" type="url" placeholder="请输入头像 URL" />
        </label>
        <label class="field-item">
          <span>个人简介</span>
          <textarea v-model="createForm.userProfile" rows="4" placeholder="请输入个人简介"></textarea>
        </label>
        <label class="field-item">
          <span>用户角色</span>
          <select v-model="createForm.userRole">
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
            <option value="ban">已封禁</option>
          </select>
        </label>
        <p class="form-tip">创建用户时不设置密码，账号可由后续流程完成认证配置。</p>
      </div>
    </Modal>

    <Modal v-model:open="showEditModal" title="编辑用户信息" :confirm-loading="isSaving" ok-text="保存修改" cancel-text="取消" @ok="handleSaveUser" @cancel="closeEditModal">
      <div class="edit-form">
        <label class="field-item">
          <span>用户昵称</span>
          <input v-model="editForm.userName" type="text" placeholder="请输入用户昵称" />
        </label>
        <label class="field-item">
          <span>头像地址</span>
          <input v-model="editForm.userAvatar" type="url" placeholder="请输入头像 URL" />
        </label>
        <label class="field-item">
          <span>个人简介</span>
          <textarea v-model="editForm.userProfile" rows="4" placeholder="请输入个人简介"></textarea>
        </label>
        <label class="field-item">
          <span>用户角色</span>
          <select v-model="editForm.userRole">
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
            <option value="ban">已封禁</option>
          </select>
        </label>
      </div>
    </Modal>
  </section>
</template>

<style scoped>
.user-manage-page {
  width: min(1280px, calc(100% - 48px));
  margin: 0 auto;
  color: #1f2d3d;
}

.page-header,
.table-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.page-header {
  margin-bottom: 24px;
}

.page-eyebrow {
  margin: 0 0 8px;
  color: #3478d4;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 8px;
  color: #152b46;
  font-size: 30px;
}

.page-header p:last-child {
  margin-bottom: 0;
  color: #728196;
}

.header-stat {
  min-width: 110px;
  padding-left: 20px;
  border-left: 1px solid #dce7f2;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

.create-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.create-button span {
  font-size: 18px;
  line-height: 1;
}

.header-stat strong,
.header-stat span {
  display: block;
}

.header-stat strong {
  color: #2679d9;
  font-size: 28px;
  line-height: 1.1;
}

.header-stat span {
  margin-top: 5px;
  color: #8291a4;
  font-size: 12px;
}

.query-panel,
.table-panel {
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

.query-actions,
.action-buttons,
.pagination {
  display: flex;
  align-items: center;
  gap: 8px;
}

.query-actions {
  flex: 0 0 auto;
}

.primary-button,
.secondary-button,
.pagination button {
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

.secondary-button,
.pagination button {
  color: #52647b;
  background: #fff;
  border: 1px solid #d8e4ef;
}

.primary-button:hover:not(:disabled) {
  background: #1768c5;
}

.secondary-button:hover,
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

.user-cell img,
.avatar-fallback {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.user-cell img {
  object-fit: cover;
}

.avatar-fallback {
  display: grid;
  place-items: center;
  color: #2679d9;
  background: #e8f2ff;
  font-size: 13px;
  font-weight: 700;
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

.edit-form {
  display: grid;
  gap: 16px;
}

.field-item em {
  margin-left: 4px;
  color: #d94b5b;
  font-size: 11px;
  font-style: normal;
  font-weight: 400;
}

.form-tip {
  margin: -4px 0 0;
  color: #8b99aa;
  font-size: 12px;
  line-height: 1.6;
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
  .page-header {
    align-items: flex-start;
  }

  .header-actions {
    align-items: flex-end;
    flex-direction: column-reverse;
    gap: 12px;
  }

  .header-stat {
    min-width: 76px;
    padding-left: 12px;
  }

  .query-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .table-toolbar {
    align-items: flex-start;
  }

  .table-hint {
    display: none;
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
