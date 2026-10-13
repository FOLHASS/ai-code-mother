import { computed, onUnmounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'

import { getUserVoList } from '@/api/userController.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

/** 查询条件与分页结果由列表持有，弹窗保存后只需要调用 loadUsers。 */
export function useUserList() {
  const router = useRouter()
  const loginUserStore = useLoginUserStore()
  const isAdmin = computed(() => loginUserStore.loginUser.userRole === 'admin')
  const isLoading = ref(false)
  const currentPage = ref(1)
  const pageSize = 10
  const totalUsers = ref(0)
  const users = ref<API.UserVO[]>([])
  let requestVersion = 0
  const appliedQuery = reactive<API.UserQueryRequest>({
    id: undefined,
    userName: '',
    userAccount: '',
    userProfile: '',
    userRole: undefined,
  })

  const loadUsers = async () => {
    const version = ++requestVersion
    if (!isAdmin.value) {
      await router.replace('/')
      return
    }

    isLoading.value = true
    try {
      const response = await getUserVoList({
        ...appliedQuery,
        id: appliedQuery.id || undefined,
        userName: appliedQuery.userName?.trim() || undefined,
        userAccount: appliedQuery.userAccount?.trim() || undefined,
        userProfile: appliedQuery.userProfile?.trim() || undefined,
        pageNum: currentPage.value,
        pageSize,
      })
      if (version !== requestVersion) return

      if (response.data.code !== 0) {
        message.error(response.data.message || '用户列表加载失败')
        return
      }

      users.value = response.data.data?.records || []
      totalUsers.value = response.data.data?.totalRow || 0
    } catch {
      if (version === requestVersion) message.error('网络异常，用户列表加载失败')
    } finally {
      if (version === requestVersion) isLoading.value = false
    }
  }

  const handleSearch = async (query: API.UserQueryRequest) => {
    Object.assign(appliedQuery, query)
    currentPage.value = 1
    await loadUsers()
  }

  const handleReset = async () => {
    appliedQuery.id = undefined
    appliedQuery.userName = ''
    appliedQuery.userAccount = ''
    appliedQuery.userProfile = ''
    appliedQuery.userRole = undefined
    currentPage.value = 1
    await loadUsers()
  }

  const handlePageChange = async (page: number) => {
    currentPage.value = page
    await loadUsers()
  }

  onUnmounted(() => { requestVersion += 1 })

  return {
    isAdmin,
    isLoading,
    currentPage,
    pageSize,
    totalUsers,
    users,
    loadUsers,
    handleSearch,
    handleReset,
    handlePageChange,
  }
}
