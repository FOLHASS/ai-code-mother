/**
 * 首页应用数据的状态所有者：维护“我的作品”和“精选案例”的请求、搜索、分页与名称同步。
 * 页面只调用返回的动作并绑定响应式结果，卡片和画廊组件不直接请求列表接口。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'

import { listGoodAppVoByPage, listMyAppVoByPage } from '@/api/appController.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

/** 首页两组分页列表各自持有加载、筛选和当前页，卡片操作只更新受影响的列表。 */
export function useHomeApps() {
  const loginUserStore = useLoginUserStore()
  // 两套分页互不影响，分别保存加载标志、当前记录、总条数和当前页码。
  const isMyLoading = ref(false)
  const isGoodLoading = ref(false)
  const myApps = ref<API.AppVO[]>([])
  const goodApps = ref<API.AppVO[]>([])
  const myTotal = ref(0)
  const goodTotal = ref(0)
  const myPage = ref(1)
  const goodPage = ref(1)
  // 首页每组每页展示六张卡片；精选搜索只作用于 goodApps，不改变“我的作品”的页码。
  const pageSize = 6
  const goodSearch = ref('')
  // 登录状态从 Store 派生；身份发生变化时会清空或重新获取当前用户的作品。
  const isLoggedIn = computed(() => Boolean(loginUserStore.loginUser.id))
  // 各请求使用递增版本号：快速翻页或卸载后，旧响应不得覆盖较新的列表与 loading 状态。
  let myRequestVersion = 0
  let goodRequestVersion = 0

  /** 以创建时间倒序获取本人当前页作品；未登录时清空已有记录，避免显示前一个用户的数据。 */
  const loadMyApps = async () => {
    // 先递增版本再检查登录状态；退出登录也会使此前尚未返回的作品请求失效。
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
      // 请求期间可能已翻页、切换账号或卸载，只处理仍然有效的这一轮响应。
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
      // 仅当前请求能结束自己的加载态，旧请求不能提前隐藏后续请求的骨架屏。
      if (version === myRequestVersion) isMyLoading.value = false
    }
  }

  /** 获取精选案例当前页；空白搜索词不发送 appName，继续沿用后端精选规则与创建时间排序。 */
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
      // 精选列表独立判断请求版本，避免较慢的旧搜索结果覆盖最新关键词对应的数据。
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

  /**
   * 弹窗保存后只替换同 ID 记录的名称，保留卡片已有用户信息、封面等未修改字段。
   * 同一应用可能同时出现在本人作品和精选案例中，因此两组列表都需要同步。
   */
  const handleAppSaved = (updatedApp: API.AppVO) => {
    // map 返回新数组和被修改项的新对象，让依赖卡片数据的响应式计算获得更新。
    const updateName = (app: API.AppVO) =>
      app.id === updatedApp.id ? { ...app, appName: updatedApp.appName } : app
    myApps.value = myApps.value.map(updateName)
    goodApps.value = goodApps.value.map(updateName)
    // 有名称筛选时重新查询，保证精选列表仍符合当前搜索条件。
    if (goodSearch.value.trim()) void loadGoodApps()
  }

  // 搜索条件变化后从第一页开始查询，避免使用原页码导致筛选结果明明存在却展示空页。
  const searchGoodApps = async () => {
    goodPage.value = 1
    await loadGoodApps()
  }

  // 翻页入口由画廊发出目标页；页码更新后统一复用对应列表请求函数。
  const changeMyPage = async (page: number) => {
    myPage.value = page
    await loadMyApps()
  }
  // 精选翻页沿用当前关键词，并且不会重置“我的作品”区域的分页状态。
  const changeGoodPage = async (page: number) => {
    goodPage.value = page
    await loadGoodApps()
  }

  // 首次挂载先等待登录态，再并行获取两组列表；标记用于避免初始化期间身份监听重复请求。
  let initialized = false
  onMounted(async () => {
    await loginUserStore.fetchLoginUser()
    await Promise.all([loadMyApps(), loadGoodApps()])
    initialized = true
  })

  // 初始化完成后的登录、退出或账号切换只刷新本人作品；精选案例不依赖当前用户身份。
  watch(
    () => loginUserStore.loginUser.id,
    () => {
      if (initialized) void loadMyApps()
    },
  )
  // 此处不取消网络请求，而是递增版本使卸载前的异步结果失效，阻止其继续更新本页状态。
  onUnmounted(() => {
    myRequestVersion += 1
    goodRequestVersion += 1
  })
  // 统一暴露派生值、可绑定状态和业务动作，页面可直接解构 ref 而不丢失响应性。
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
