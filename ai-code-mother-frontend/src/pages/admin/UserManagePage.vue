<script setup lang="ts">
/**
 * 用户管理页面负责组装搜索面板、数据表格和创建/编辑弹窗，不直接维护请求细节。
 * UserListController 是查询条件、分页、列表和管理员显示状态的唯一所有者。
 * UserMutationsController 接收列表引用、页码和刷新方法，负责增删改、确认框及弹窗开关。
 * 搜索、分页、编辑、删除由子组件 Emits 回传；表单提交成功后由控制器刷新列表。
 * 模板的 isAdmin 控制页面展示，路由守卫与后端管理员校验共同约束真实访问权限。
 */
import { useUserListController, useUserMutationsController } from '@/app/controllers.ts'
import PageHeader from '@/components/PageHeader.vue'
import PageStat from '@/components/PageStat.vue'
import { UserSearchPanel } from '@/features/user-management/components'
import { UserTable } from '@/features/user-management/components'
import { UserFormModal } from '@/features/user-management/components'

// 列表状态直接传给搜索和表格；加载动作共享同一份已应用查询条件。
const listController = useUserListController()
const {
  isAdmin,
  isLoading,
  currentPage,
  pageSize,
  totalUsers,
  users,
  handleSearch,
  handleReset,
  handlePageChange,
} = listController
// 两个 UserFormModal 实例复用同一表单实现，通过 mode 和不同加载状态区分创建与编辑。
const mutationsController = useUserMutationsController(listController)
const {
  isSaving,
  isDeleting,
  isCreating,
  showCreateModal,
  showEditModal,
  selectedUser,
  openEditModal,
  openCreateModal,
  closeCreateModal,
  handleCreateUser,
  closeEditModal,
  handleSaveUser,
  handleDeleteUser,
} = mutationsController
</script>
<template>
  <section v-if="isAdmin" class="user-manage-page">
    <PageHeader eyebrow="ADMIN CONSOLE" title="用户管理" description="集中查看和维护平台用户信息。">
      <template #actions>
        <div class="header-actions">
          <PageStat :value="totalUsers" label="用户总数" />
          <button class="primary-button create-button" type="button" @click="openCreateModal">
            <span aria-hidden="true">＋</span>
            创建用户
          </button>
        </div>
      </template>
    </PageHeader>

    <UserSearchPanel :is-loading="isLoading" @search="handleSearch" @reset="handleReset" />

    <UserTable
      :users="users"
      :total-users="totalUsers"
      :is-loading="isLoading"
      :is-deleting="isDeleting"
      :current-page="currentPage"
      :page-size="pageSize"
      @edit="openEditModal"
      @delete="handleDeleteUser"
      @page-change="handlePageChange"
    />

    <UserFormModal
      :open="showCreateModal"
      mode="create"
      :loading="isCreating"
      @close="closeCreateModal"
      @submit="handleCreateUser"
    />
    <UserFormModal
      :open="showEditModal"
      mode="edit"
      :loading="isSaving"
      :user="selectedUser"
      @close="closeEditModal"
      @submit="handleSaveUser"
    />
  </section>
</template>

<style scoped>
/* 管理页宽度与其他后台页面一致，保留居中边距。 */
.user-manage-page {
  width: min(1280px, calc(100% - 48px));
  margin: 0 auto;
  color: #1f2d3d;
}

/* 页头把用户统计与创建入口横向排布。 */
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

.primary-button {
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

.primary-button:hover:not(:disabled) {
  background: #1768c5;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

/* 窄屏将页头操作上下排列，使创建按钮与统计文案保有独立空间。 */
@media (max-width: 700px) {
  .header-actions {
    align-items: flex-end;
    flex-direction: column-reverse;
    gap: 12px;
  }
}
</style>
