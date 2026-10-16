import { ref, type Ref } from 'vue'
import { message, Modal } from 'ant-design-vue'

import { addUser, deleteUser, updateUser } from '@/api/userController.ts'

/**
 * 来自列表组合函数的最小上下文：使用同一列表判断删除后的翻页，同一刷新动作保留查询规则。
 * 本模块不创建第二份列表数据或分页状态。
 */
type UserMutationsContext = {
  // 当前页用户数组，只读取其数量以判断是否需要回退页码。
  users: Ref<API.UserVO[]>
  // 共享页码：创建成功回首页，删除本页最后一条且不在首页时回上一页。
  currentPage: Ref<number>
  // 由列表模块提供的异步刷新方法，复用当前已应用的筛选条件。
  loadUsers: () => Promise<void>
}

/** 用户增删改保留弹窗、确认和加载状态；列表刷新由调用方提供。 */
/**
 * 管理员用户增删改及弹窗状态的所有者。
 * 创建、保存、删除分别维护加载态，避免互相借用导致按钮显示混乱；接口权限由后端校验。
 * 返回开关、选中用户和动作给页面，表单子组件通过 Emits 提交数据而不自行请求。
 */
export function useUserMutations({ users, currentPage, loadUsers }: UserMutationsContext) {
  const isSaving = ref(false)
  const isDeleting = ref(false)
  const isCreating = ref(false)
  // 创建和编辑各自控制开关；selectedUser 用于向编辑表单提供回填数据。
  const showCreateModal = ref(false)
  const showEditModal = ref(false)
  const selectedUser = ref<API.UserVO | null>(null)

  /**
   * 记录列表中选中的用户并打开编辑窗；表单组件会拷贝可编辑字段，不直接修改该用户对象。
   */
  const openEditModal = (user: API.UserVO) => {
    selectedUser.value = user
    showEditModal.value = true
  }

  /**
   * 打开创建窗；窗口中表单由打开状态监听器重置为默认值。
   */
  const openCreateModal = () => {
    showCreateModal.value = true
  }

  /**
   * 创建请求期间阻止关闭，避免请求还未完成时隐藏当前操作反馈。
   */
  const closeCreateModal = () => {
    if (!isCreating.value) {
      showCreateModal.value = false
    }
  }

  /**
   * 接收创建表单，校验非空账号并规范化可选文本，然后调用新增接口。
   * 成功后关闭弹窗、切换第 1 页并刷新；失败保持弹窗及草稿，便于用户修正或重试。
   */
  const handleCreateUser = async (form: API.UserAddRequest) => {
    const userAccount = form.userAccount?.trim() || ''
    if (!userAccount) {
      message.warning('请填写用户账号')
      return
    }

    isCreating.value = true
    try {
      // 只去除文本首尾空格，角色等其他表单字段沿用调用方提交值。
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
      // 创建后查看第 1 页，已生效的筛选条件由 loadUsers 继续管理。
      currentPage.value = 1
      await loadUsers()
    } catch {
      message.error('网络异常，用户创建失败')
    } finally {
      isCreating.value = false
    }
  }

  /**
   * 保存尚未完成时保持编辑窗打开，避免中途关闭后无法判断操作结果。
   */
  const closeEditModal = () => {
    if (!isSaving.value) {
      showEditModal.value = false
    }
  }

  /**
   * 接收包含用户 ID 的编辑表单，校验 ID 与昵称后提交更新。
   * 保存成功关闭编辑窗并刷新当前页；业务失败和网络异常分别提示，finally 恢复加载态。
   */
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

  /**
   * 接收目标用户并先显示二次确认；没有用户 ID 时不发起操作。
   * 只有确认框 onOk 才请求删除，删除成功后根据当前页条数决定是否回退上一页并刷新。
   */
  const handleDeleteUser = (user: API.UserVO) => {
    if (!user.id) return

    Modal.confirm({
      title: '确认删除用户？',
      content: `删除后将无法恢复用户“${user.userName || user.userAccount || user.id}”。`,
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      // 返回异步确认回调，让对话框跟随删除操作的 Promise 执行确认流程。
      onOk: async () => {
        isDeleting.value = true
        try {
          const response = await deleteUser({ id: user.id })
          if (response.data.code !== 0 || !response.data.data) {
            message.error(response.data.message || '用户删除失败')
            return
          }

          message.success('用户已删除')
          // 避免删除当前页唯一一条记录后停留在空的末页；首页不再向前回退。
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

  // 管理页可直接绑定这些加载态与事件处理方法，组件内部不再重复维护 CRUD 流程。
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
