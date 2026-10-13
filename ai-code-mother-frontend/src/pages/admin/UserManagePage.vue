<script setup lang="ts">
import { onMounted } from 'vue'

import PageHeader from '@/components/PageHeader.vue'
import PageStat from '@/components/PageStat.vue'
import UserSearchPanel from './user-manage/components/UserSearchPanel.vue'
import UserTable from './user-manage/components/UserTable.vue'
import UserFormModal from './user-manage/components/UserFormModal.vue'
import { useUserList } from './user-manage/composables/useUserList.ts'
import { useUserMutations } from './user-manage/composables/useUserMutations.ts'

const { isAdmin, isLoading, currentPage, pageSize, totalUsers, users,
  loadUsers, handleSearch, handleReset, handlePageChange } = useUserList()
const { isSaving, isDeleting, isCreating, showCreateModal, showEditModal, selectedUser,
  openEditModal, openCreateModal, closeCreateModal, handleCreateUser,
  closeEditModal, handleSaveUser, handleDeleteUser } = useUserMutations({ users, currentPage, loadUsers })

onMounted(() => {
  void loadUsers()
})
</script><template>
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
.user-manage-page {
  width: min(1280px, calc(100% - 48px));
  margin: 0 auto;
  color: #1f2d3d;
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
  background: #2679d9;
  border: 1px solid #2679d9;
}

.primary-button:hover:not(:disabled) {
  background: #1768c5;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 700px) {
  .header-actions {
    align-items: flex-end;
    flex-direction: column-reverse;
    gap: 12px;
  }
}</style>
