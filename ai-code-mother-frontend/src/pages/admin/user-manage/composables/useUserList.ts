import { computed, onUnmounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'

import { getUserVoList } from '@/api/userController.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

/** 查询条件与分页结果由列表持有，弹窗保存后只需要调用 loadUsers。 */
/**
 * 创建用户分页列表的状态和查询动作。
 * 返回列表数据、分页及加载状态，以及搜索、重置、翻页和刷新方法；调用方共享这些引用而不另存列表副本。
 * 列表查询按 requestVersion 判断结果新旧，避免较早的响应覆盖新条件对应的数据。
 */
export function useUserList() {
  const router = useRouter()
  const loginUserStore = useLoginUserStore()
  // 前端按共享登录资料判断管理员身份；这用于显示与跳转，接口仍需要后端独立授权。
  const isAdmin = computed(() => loginUserStore.loginUser.userRole === 'admin')
  const isLoading = ref(false)
  // 页码从 1 开始，页容量固定为 10；搜索和重置回到首页。
  const currentPage = ref(1)
  const pageSize = 10
  const totalUsers = ref(0)
  const users = ref<API.UserVO[]>([])
  // 每次查询递增版本号；请求并未在网络层取消，而是让旧响应失去更新状态的资格。
  let requestVersion = 0
  // 这里只保存已点击查询生效的条件，搜索面板内尚未提交的草稿不会影响翻页。
  const appliedQuery = reactive<API.UserQueryRequest>({
    id: undefined,
    userName: '',
    userAccount: '',
    userProfile: '',
    userRole: undefined,
  })

  /**
   * 根据已应用条件和当前页刷新列表，返回请求完成后的 Promise。
   * 非管理员会被替换跳转到首页；业务错误保留已有列表，仅向用户显示失败信息。
   * 成功、异常和 finally 都受版本号约束，旧请求不能覆盖新数据或提前关闭新请求的加载态。
   */
  const loadUsers = async () => {
    // 先推进版本号，即使本次因权限退出，也能让此前尚未返回的请求作废。
    const version = ++requestVersion
    if (!isAdmin.value) {
      await router.replace('/')
      return
    }

    isLoading.value = true
    try {
      // 文本条件提交前去空格，空值转 undefined，分页参数与业务条件一起传给生成接口。
      const response = await getUserVoList({
        ...appliedQuery,
        id: appliedQuery.id || undefined,
        userName: appliedQuery.userName?.trim() || undefined,
        userAccount: appliedQuery.userAccount?.trim() || undefined,
        userProfile: appliedQuery.userProfile?.trim() || undefined,
        pageNum: currentPage.value,
        pageSize,
      })
      // 已经开始过更新的一次查询时，本次返回结果不再写入列表。
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

  /**
   * 接收搜索面板提交的条件副本，将其应用到查询状态并重新加载第 1 页。
   */
  const handleSearch = async (query: API.UserQueryRequest) => {
    Object.assign(appliedQuery, query)
    currentPage.value = 1
    await loadUsers()
  }

  /**
   * 逐一清空本模块负责的筛选字段，再请求第 1 页；与面板自己的草稿重置共同完成恢复。
   */
  const handleReset = async () => {
    appliedQuery.id = undefined
    appliedQuery.userName = ''
    appliedQuery.userAccount = ''
    appliedQuery.userProfile = ''
    appliedQuery.userRole = undefined
    currentPage.value = 1
    await loadUsers()
  }

  /**
   * 接收表格发出的目标页码，在保留已应用筛选条件的情况下加载该页。
   */
  const handlePageChange = async (page: number) => {
    currentPage.value = page
    await loadUsers()
  }

  // 卸载时推进版本号，尚未完成的请求返回后不会更新已经离开的页面。
  onUnmounted(() => { requestVersion += 1 })

  // 把状态及动作作为同一查询模型交给管理页，增删改逻辑可复用 loadUsers 刷新。
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
