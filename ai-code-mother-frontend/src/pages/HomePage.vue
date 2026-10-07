<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useRouter } from 'vue-router'

import { addApp, deleteApp, listGoodAppVoByPage, listMyAppVoByPage } from '@/api/appController.ts'
import AppCard from '@/components/AppCard.vue'
import AppEditModal from '@/components/AppEditModal.vue'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

const router = useRouter()
const loginUserStore = useLoginUserStore()
const prompt = ref('')
const isCreating = ref(false)
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
const editingApp = ref<API.AppVO | null>(null)
const showEditModal = ref(false)

const isLoggedIn = computed(() => Boolean(loginUserStore.loginUser.id))
const displayName = computed(
  () => loginUserStore.loginUser.userName || loginUserStore.loginUser.userAccount || '创作者',
)

const loadMyApps = async () => {
  if (!isLoggedIn.value) {
    myApps.value = []
    myTotal.value = 0
    return
  }
  isMyLoading.value = true
  try {
    const response = await listMyAppVoByPage({ pageNum: myPage.value, pageSize, sortField: 'createTime', sortOrder: 'descend' })
    if (response.data.code !== 0) {
      message.error(response.data.message || '我的应用加载失败')
      return
    }
    myApps.value = response.data.data?.records || []
    myTotal.value = response.data.data?.totalRow || 0
  } catch {
    message.error('网络异常，我的应用加载失败')
  } finally {
    isMyLoading.value = false
  }
}

const loadGoodApps = async () => {
  isGoodLoading.value = true
  try {
    const response = await listGoodAppVoByPage({
      pageNum: goodPage.value,
      pageSize,
      appName: goodSearch.value.trim() || undefined,
      sortField: 'createTime',
      sortOrder: 'descend',
    })
    if (response.data.code !== 0) {
      message.error(response.data.message || '精选应用加载失败')
      return
    }
    goodApps.value = response.data.data?.records || []
    goodTotal.value = response.data.data?.totalRow || 0
  } catch {
    message.error('网络异常，精选应用加载失败')
  } finally {
    isGoodLoading.value = false
  }
}

const submitPrompt = async () => {
  const initPrompt = prompt.value.trim()
  if (!initPrompt) {
    message.warning('先描述你想创建的网站')
    return
  }
  if (!isLoggedIn.value) {
    await router.push({ path: '/user/login', query: { redirect: '/' } })
    return
  }
  isCreating.value = true
  try {
    const response = await addApp({ initPrompt })
    if (response.data.code !== 0 || !response.data.data) {
      message.error(response.data.message || '应用创建失败')
      return
    }
    await router.push(`/app/${response.data.data}`)
  } catch {
    message.error('网络异常，应用创建失败')
  } finally {
    isCreating.value = false
  }
}

const openApp = (app: API.AppVO) => {
  if (app.id) void router.push(`/app/${app.id}`)
}

const editApp = (app: API.AppVO) => {
  if (!app.id) return
  if (!isLoggedIn.value || String(app.userId) !== String(loginUserStore.loginUser.id)) {
    message.warning('只能编辑自己的作品')
    return
  }
  editingApp.value = app
  showEditModal.value = true
}

const handleAppSaved = (updatedApp: API.AppVO) => {
  const updateName = (app: API.AppVO) => app.id === updatedApp.id
    ? { ...app, appName: updatedApp.appName }
    : app
  myApps.value = myApps.value.map(updateName)
  goodApps.value = goodApps.value.map(updateName)
  // 有名称筛选时重新查询，保证精选列表仍符合当前搜索条件。
  if (goodSearch.value.trim()) void loadGoodApps()
}

const removeApp = (app: API.AppVO) => {
  if (!app.id) return
  Modal.confirm({
    title: '删除这个应用？',
    content: `删除后将无法恢复“${app.appName || '未命名应用'}”。`,
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        const response = await deleteApp({ id: app.id })
        if (response.data.code !== 0 || !response.data.data) {
          message.error(response.data.message || '应用删除失败')
          return
        }
        message.success('应用已删除')
        if (myApps.value.length === 1 && myPage.value > 1) myPage.value -= 1
        await loadMyApps()
      } catch {
        message.error('网络异常，应用删除失败')
      }
    },
  })
}

const searchGoodApps = async () => {
  goodPage.value = 1
  await loadGoodApps()
}

const totalPages = (total: number) => Math.max(1, Math.ceil(total / pageSize))

onMounted(async () => {
  await loginUserStore.fetchLoginUser()
  await Promise.all([loadMyApps(), loadGoodApps()])
})

watch(() => loginUserStore.loginUser.id, () => void loadMyApps())
</script>

<template>
  <main class="home-page">
    <section class="hero-section">
      <div class="hero-orb orb-left"></div>
      <div class="hero-orb orb-right"></div>
      <div class="hero-content">
        <p class="hero-kicker"><span></span> AI 创作工作台</p>
        <h1>一句话 <b>呈所想</b></h1>
        <p class="hero-subtitle">与 AI 对话，轻松创建应用和网站</p>
        <form class="prompt-card" @submit.prevent="submitPrompt">
          <textarea v-model="prompt" :disabled="isCreating" rows="4" placeholder="使用 NoCode 创建一个高效的小工具，帮我计算……" aria-label="输入应用需求"></textarea>
          <div class="prompt-footer">
            <span class="prompt-hint">描述越具体，生成效果越好</span>
            <button class="prompt-submit" type="submit" :disabled="isCreating">
              <span v-if="isCreating" class="spinner"></span><span v-else aria-hidden="true">↑</span>
            </button>
          </div>
        </form>
        <div class="prompt-examples" aria-label="示例需求">
          <button type="button" @click="prompt = '帮我做一个简洁的个人博客网站'">个人博客网站</button>
          <button type="button" @click="prompt = '帮我做一个企业服务介绍网站'">企业网站</button>
          <button type="button" @click="prompt = '帮我做一个电商运营后台'">电商运营后台</button>
          <button type="button" @click="prompt = '帮我做一个暗黑风格的主题社区'">暗黑主题社区</button>
        </div>
      </div>
    </section>

    <section class="gallery-shell">
      <section class="gallery-section">
        <div class="section-header">
          <div>
            <p class="section-kicker">MY WORKSPACE</p>
            <h2>我的作品</h2>
            <p v-if="isLoggedIn">{{ displayName }} 的应用会在这里持续成长</p>
            <p v-else>登录后创建和管理属于你的应用</p>
          </div>
          <button v-if="!isLoggedIn" class="outline-button" type="button" @click="router.push('/user/login')">登录查看</button>
        </div>
        <div v-if="!isLoggedIn" class="login-empty">
          <div class="empty-icon">✦</div><strong>登录后开始你的创作</strong><span>你的应用、对话和迭代记录都会保存在这里</span>
          <button class="primary-button" type="button" @click="router.push('/user/login')">去登录</button>
        </div>
        <div v-else-if="isMyLoading" class="card-grid loading-grid"><div v-for="n in 3" :key="n" class="skeleton-card"></div></div>
        <div v-else-if="myApps.length" class="card-grid">
          <AppCard
            v-for="app in myApps"
            :key="app.id"
            :app="app"
            @open="openApp"
            @edit="editApp"
            @remove="removeApp"
          />
        </div>
        <div v-else class="plain-empty">还没有应用，从上面的输入框开始创建吧。</div>
        <div v-if="isLoggedIn && myTotal > pageSize" class="pagination-bar">
          <button type="button" :disabled="myPage <= 1 || isMyLoading" @click="myPage -= 1; loadMyApps()">上一页</button><span>{{ myPage }} / {{ totalPages(myTotal) }}</span><button type="button" :disabled="myPage >= totalPages(myTotal) || isMyLoading" @click="myPage += 1; loadMyApps()">下一页</button>
        </div>
      </section>

      <section class="gallery-section featured-section">
        <div class="section-header">
          <div><p class="section-kicker">CURATED SHOWCASE</p><h2>精选案例</h2><p>看看社区里正在发生的好想法</p></div>
          <form class="search-box" @submit.prevent="searchGoodApps"><input v-model="goodSearch" type="search" placeholder="搜索应用名称" aria-label="搜索精选应用" /><button type="submit" aria-label="搜索">⌕</button></form>
        </div>
        <div v-if="isGoodLoading" class="card-grid loading-grid"><div v-for="n in 3" :key="n" class="skeleton-card"></div></div>
        <div v-else-if="goodApps.length" class="card-grid">
          <AppCard
            v-for="app in goodApps"
            :key="app.id"
            :app="app"
            variant="featured"
            :show-actions="false"
            @open="openApp"
          />
        </div>
        <div v-else class="plain-empty">暂时没有匹配的精选应用。</div>
        <div v-if="goodTotal > pageSize" class="pagination-bar">
          <button type="button" :disabled="goodPage <= 1 || isGoodLoading" @click="goodPage -= 1; loadGoodApps()">上一页</button><span>{{ goodPage }} / {{ totalPages(goodTotal) }}</span><button type="button" :disabled="goodPage >= totalPages(goodTotal) || isGoodLoading" @click="goodPage += 1; loadGoodApps()">下一页</button>
        </div>
      </section>
    </section>
    <AppEditModal v-model:open="showEditModal" :app="editingApp" @saved="handleAppSaved" />
  </main>
</template>

<style scoped>
.home-page { color: #172d49; }
.hero-section { position: relative; min-height: 595px; overflow: hidden; background: linear-gradient(120deg, #f8fdfb 0%, #fbffff 36%, #d5fbf0 64%, #6db8ec 100%); }
.hero-section::after { position: absolute; inset: 0; content: ''; background: radial-gradient(circle at 53% 37%, rgb(255 255 255 / 92%), transparent 23%), radial-gradient(circle at 84% 78%, rgb(37 144 220 / 26%), transparent 34%); pointer-events: none; }
.hero-orb { position: absolute; border: 1px solid rgb(255 255 255 / 48%); border-radius: 50%; transform: rotate(-17deg); opacity: .8; }
.orb-left { left: -170px; bottom: -290px; width: 680px; height: 440px; }
.orb-right { right: -150px; top: -210px; width: 720px; height: 500px; }
.hero-content { position: relative; z-index: 1; width: min(920px, calc(100% - 40px)); margin: 0 auto; padding: 72px 0 80px; text-align: center; }
.hero-kicker { display: inline-flex; align-items: center; gap: 8px; margin: 0; color: #347a9a; font-size: 12px; font-weight: 700; letter-spacing: .14em; }
.hero-kicker span { width: 7px; height: 7px; background: #21c6a5; border-radius: 50%; box-shadow: 0 0 0 5px rgb(33 198 165 / 15%); }
.hero-content h1 { margin: 25px 0 8px; color: #111c2a; font-size: clamp(44px, 7vw, 82px); font-weight: 750; letter-spacing: -.04em; line-height: 1.05; }
.hero-content h1 b { color: #101d2c; font-weight: inherit; }
.hero-subtitle { margin: 0 0 35px; color: #607789; font-size: 18px; }
.prompt-card { width: min(100%, 780px); margin: 0 auto; padding: 18px 18px 13px; text-align: left; background: rgb(255 255 255 / 93%); border: 1px solid rgb(255 255 255 / 80%); border-radius: 20px; box-shadow: 0 20px 50px rgb(49 126 152 / 16%); }
.prompt-card textarea { display: block; width: 100%; min-height: 105px; padding: 0 5px; color: #213a53; font: inherit; font-size: 18px; line-height: 1.55; background: transparent; border: 0; outline: 0; resize: vertical; }
.prompt-card textarea::placeholder { color: #a1adba; }
.prompt-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; }
.prompt-hint { color: #a0acb7; font-size: 12px; }
.prompt-submit { display: grid; width: 45px; height: 45px; color: #fff; font-size: 25px; font-weight: 300; place-items: center; background: #8a9499; border: 0; border-radius: 50%; cursor: pointer; }
.prompt-submit:not(:disabled):hover { background: #1d827a; transform: translateY(-1px); }
.prompt-submit:disabled { cursor: wait; opacity: .7; }
.spinner { width: 18px; height: 18px; border: 2px solid rgb(255 255 255 / 35%); border-top-color: #fff; border-radius: 50%; animation: spin .8s linear infinite; }
.prompt-examples { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; margin-top: 17px; }
.prompt-examples button { padding: 9px 17px; color: #577284; font: inherit; font-size: 13px; background: rgb(255 255 255 / 88%); border: 1px solid rgb(255 255 255 / 70%); border-radius: 999px; cursor: pointer; }
.prompt-examples button:hover { color: #168f80; border-color: #8bdccb; }
.gallery-shell { width: min(1180px, calc(100% - 40px)); margin: -32px auto 0; position: relative; z-index: 2; padding: 35px 45px 68px; background: #fff; border-radius: 30px 30px 0 0; box-shadow: 0 -12px 45px rgb(53 125 169 / 10%); }
.gallery-section + .gallery-section { margin-top: 66px; }
.section-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 25px; }
.section-kicker { margin: 0 0 8px; color: #2ca48e; font-size: 11px; font-weight: 750; letter-spacing: .16em; }
.section-header h2 { margin: 0 0 7px; color: #152b42; font-size: 28px; letter-spacing: -.02em; }
.section-header p:last-child { margin: 0; color: #94a0ad; font-size: 13px; }
.card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; }
.outline-button, .primary-button, .secondary-button { min-height: 37px; padding: 0 15px; font: inherit; font-size: 13px; border-radius: 7px; cursor: pointer; }
.outline-button { color: #2c8c84; background: #fff; border: 1px solid #b6e4dc; }
.primary-button { color: #fff; background: #238f83; border: 1px solid #238f83; }
.secondary-button { color: #517083; background: #fff; border: 1px solid #d8e4e9; }
.login-empty { display: flex; align-items: center; gap: 17px; padding: 24px; background: #f7fbfa; border: 1px dashed #b9e3db; border-radius: 13px; }
.empty-icon { display: grid; width: 42px; height: 42px; color: #fff; font-size: 20px; place-items: center; background: #53b9aa; border-radius: 13px; }
.login-empty strong { color: #1e3f4b; font-size: 15px; }
.login-empty span { flex: 1; color: #8a9da4; font-size: 13px; }
.plain-empty { padding: 45px 20px; color: #9aa8b1; font-size: 13px; text-align: center; background: #fbfdfd; border: 1px dashed #e3ebed; border-radius: 12px; }
.pagination-bar { display: flex; align-items: center; justify-content: center; gap: 15px; margin-top: 25px; color: #8c9ba4; font-size: 12px; }
.pagination-bar button { padding: 6px 11px; color: #547580; background: #fff; border: 1px solid #d9e8e8; border-radius: 6px; cursor: pointer; }
.pagination-bar button:disabled { color: #c7d1d4; cursor: not-allowed; }
.search-box { display: flex; width: 230px; border: 1px solid #e1ebed; border-radius: 8px; }
.search-box input { min-width: 0; flex: 1; padding: 9px 11px; color: #294353; font: inherit; font-size: 13px; border: 0; outline: 0; }
.search-box button { width: 39px; color: #4e8d92; font-size: 18px; background: #f4fbfa; border: 0; border-left: 1px solid #e1ebed; cursor: pointer; }
.skeleton-card { height: 240px; background: linear-gradient(100deg, #f0f4f6 30%, #f9fbfb 45%, #f0f4f6 60%); background-size: 200% 100%; border-radius: 14px; animation: shimmer 1.3s infinite; }
@keyframes shimmer { to { background-position: -200% 0; } }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 900px) { .gallery-shell { padding: 30px 24px 56px; } .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .hero-content { padding-top: 52px; } .hero-content h1 { font-size: 48px; } .hero-subtitle { font-size: 15px; } .gallery-shell { width: 100%; margin-top: 0; border-radius: 0; } .section-header { align-items: flex-start; flex-direction: column; } .card-grid { grid-template-columns: 1fr; gap: 22px; } .login-empty { align-items: flex-start; flex-wrap: wrap; } .login-empty span { flex-basis: calc(100% - 60px); } .login-empty .primary-button { margin-left: 59px; } .search-box { width: 100%; } }
</style>
