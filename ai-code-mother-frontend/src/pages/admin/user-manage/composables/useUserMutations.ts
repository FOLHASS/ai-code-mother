import { ref, type Ref } from 'vue'
import { message, Modal } from 'ant-design-vue'

import { addUser, deleteUser, updateUser } from '@/api/userController.ts'

type UserMutationsContext = {
  users: Ref<API.UserVO[]>
  currentPage: Ref<number>
  loadUsers: () => Promise<void>
}

/** 用户增删改保留弹窗、确认和加载状态；列表刷新由调用方提供。 */
export function useUserMutations({ users, currentPage, loadUsers }: UserMutationsContext) {
  const isSaving = ref(false)
  const isDeleting = ref(false)
  const isCreating = ref(false)
  const showCreateModal = ref(false)
  const showEditModal = ref(false)
  const selectedUser = ref<API.UserVO | null>(null)

  const openEditModal = (user: API.UserVO) => {
    selectedUser.value = user
    showEditModal.value = true
  }

  const openCreateModal = () => {
    showCreateModal.value = true
  }

  const closeCreateModal = () => {
    if (!isCreating.value) {
      showCreateModal.value = false
    }
  }

  const handleCreateUser = async (form: API.UserAddRequest) => {
    const userAccount = form.userAccount?.trim() || ''
    if (!userAccount) {
      message.warning('请填写用户账号')
      return
    }

    isCreating.value = true
    try {
      const response = await addUser({
        ...form,
        userAccount,
        userName: form.userName?.trim() || undefined,
        userAvatar: form.userAvatar?.trim() || undefined,
        userProfile: form.userProfile?.trim() || undefined,
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

  const handleSaveUser = async (form: API.UserUpdateRequest) => {
    if (!form.id || !form.userName?.trim()) {
      message.warning('请填写用户昵称')
      return
    }

    isSaving.value = true
    try {
      const response = await updateUser({
        ...form,
        userName: form.userName.trim(),
        userProfile: form.userProfile?.trim(),
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

  return {
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
  }
}
