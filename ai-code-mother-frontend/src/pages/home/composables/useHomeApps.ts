import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'

import { listGoodAppVoByPage, listMyAppVoByPage } from '@/api/appController.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

/** 首页两组分页列表各自持有加载、筛选和当前页，卡片操作只更新受影响的列表。 */
export function useHomeApps() {
  const loginUserStore = useLoginUserStore()
  const isMyLoading = ref(false)
  const isGoodLoading = ref(false)
  const myApps = ref<API.AppVO[]>([])
  const goodApps = ref<API.AppVO[]>([])
  const myTotal = ref(0)
  const goodTotal = ref(0)
  const myPage = ref(1)
  const goodPage = ref(1)
  const pageSize = 6
  const goodSearch = ref('')
  const isLoggedIn = computed(() => Boolean(loginUserStore.loginUser.id))
  let myRequestVersion = 0
  let goodRequestVersion = 0

  const loadMyApps = async () => {
    const version = ++myRequestVersion
    if (!isLoggedIn.value) {
      myApps.value = []
      myTotal.value = 0
      isMyLoading.value = false
      return
    }
    isMyLoading.value = true
    try {
      const response = await listMyAppVoByPage({
        pageNum: myPage.value,
        pageSize,
        sortField: 'createTime',
        sortOrder: 'descend',
      })
      if (version !== myRequestVersion) return
      if (response.data.code !== 0) {
        message.error(response.data.message || '我的应用加载失败')
        return
      }
      myApps.value = response.data.data?.records || []
      myTotal.value = response.data.data?.totalRow || 0
    } catch {
      if (version === myRequestVersion) message.error('网络异常，我的应用加载失败')
    } finally {
      if (version === myRequestVersion) isMyLoading.value = false
    }
  }

  const loadGoodApps = async () => {
    const version = ++goodRequestVersion
    isGoodLoading.value = true
    try {
      const response = await listGoodAppVoByPage({
        pageNum: goodPage.value,
        pageSize,
        appName: goodSearch.value.trim() || undefined,
        sortField: 'createTime',
        sortOrder: 'descend',
      })
      if (version !== goodRequestVersion) return
      if (response.data.code !== 0) {
        message.error(response.data.message || '精选应用加载失败')
        return
      }
      goodApps.value = response.data.data?.records || []
      goodTotal.value = response.data.data?.totalRow || 0
    } catch {
      if (version === goodRequestVersion) message.error('网络异常，精选应用加载失败')
    } finally {
      if (version === goodRequestVersion) isGoodLoading.value = false
    }
  }

  const handleAppSaved = (updatedApp: API.AppVO) => {
    const updateName = (app: API.AppVO) =>
      app.id === updatedApp.id ? { ...app, appName: updatedApp.appName } : app
    myApps.value = myApps.value.map(updateName)
    goodApps.value = goodApps.value.map(updateName)
    // 有名称筛选时重新查询，保证精选列表仍符合当前搜索条件。
    if (goodSearch.value.trim()) void loadGoodApps()
  }

  const searchGoodApps = async () => {
    goodPage.value = 1
    await loadGoodApps()
  }

  const changeMyPage = async (page: number) => {
    myPage.value = page
    await loadMyApps()
  }
  const changeGoodPage = async (page: number) => {
    goodPage.value = page
    await loadGoodApps()
  }

  let initialized = false
  onMounted(async () => {
    await loginUserStore.fetchLoginUser()
    await Promise.all([loadMyApps(), loadGoodApps()])
    initialized = true
  })

  watch(
    () => loginUserStore.loginUser.id,
    () => {
      if (initialized) void loadMyApps()
    },
  )
  onUnmounted(() => {
    myRequestVersion += 1
    goodRequestVersion += 1
  })
  return {
    isLoggedIn,
    isMyLoading,
    isGoodLoading,
    myApps,
    goodApps,
    myTotal,
    goodTotal,
    myPage,
    goodPage,
    pageSize,
    goodSearch,
    loadMyApps,
    searchGoodApps,
    handleAppSaved,
    changeMyPage,
    changeGoodPage,
  }
}
