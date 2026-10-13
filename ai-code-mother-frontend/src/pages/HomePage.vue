<script setup lang="ts">
import { computed, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useRouter } from 'vue-router'

import { addApp, deleteApp } from '@/api/appController.ts'
import AppEditModal from '@/components/AppEditModal.vue'
import HomePromptHero from './home/components/HomePromptHero.vue'
import AppGallerySection from './home/components/AppGallerySection.vue'
import { useHomeApps } from './home/composables/useHomeApps.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

const router = useRouter()
const loginUserStore = useLoginUserStore()
const isCreating = ref(false)
const {
  isLoggedIn, isMyLoading, isGoodLoading, myApps, goodApps, myTotal, goodTotal,
  myPage, goodPage, pageSize, goodSearch, loadMyApps, searchGoodApps,
  handleAppSaved, changeMyPage, changeGoodPage,
} = useHomeApps()
const editingApp = ref<API.AppVO | null>(null)
const showEditModal = ref(false)

const displayName = computed(
  () => loginUserStore.loginUser.userName || loginUserStore.loginUser.userAccount || '创作者',
)

const submitPrompt = async (prompt: string) => {
  const initPrompt = prompt.trim()
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

</script>

<template>
  <main class="home-page">
    <HomePromptHero :is-creating="isCreating" @create="submitPrompt" />

    <section class="gallery-shell">
      <AppGallerySection
        :apps="myApps" :total="myTotal" :page="myPage" :page-size="pageSize"
        :loading="isMyLoading" :logged-out="!isLoggedIn"
        empty-text="还没有应用，从上面的输入框开始创建吧。"
        @open="openApp" @edit="editApp" @remove="removeApp"
        @page-change="changeMyPage"
      >
        <template #header>
          <div class="section-header">
            <div>
              <p class="section-kicker">MY WORKSPACE</p>
              <h2>我的作品</h2>
              <p v-if="isLoggedIn">{{ displayName }} 的应用会在这里持续成长</p>
              <p v-else>登录后创建和管理属于你的应用</p>
            </div>
            <button v-if="!isLoggedIn" class="outline-button" type="button" @click="router.push('/user/login')">登录查看</button>
          </div>
        </template>
        <template #logged-out>
          <div class="login-empty">
            <div class="empty-icon">✦</div><strong>登录后开始你的创作</strong><span>你的应用、对话和迭代记录都会保存在这里</span>
            <button class="primary-button" type="button" @click="router.push('/user/login')">去登录</button>
          </div>
        </template>
      </AppGallerySection>

      <AppGallerySection
        :apps="goodApps" :total="goodTotal" :page="goodPage" :page-size="pageSize"
        :loading="isGoodLoading" variant="featured"
        empty-text="暂时没有匹配的精选应用。"
        @open="openApp" @page-change="changeGoodPage"
      >
        <template #header>
          <div class="section-header">
            <div><p class="section-kicker">CURATED SHOWCASE</p><h2>精选案例</h2><p>看看社区里正在发生的好想法</p></div>
            <form class="search-box" @submit.prevent="searchGoodApps"><input v-model="goodSearch" type="search" placeholder="搜索应用名称" aria-label="搜索精选应用" /><button type="submit" aria-label="搜索">⌕</button></form>
          </div>
        </template>
      </AppGallerySection>
    </section>
    <AppEditModal v-model:open="showEditModal" :app="editingApp" @saved="handleAppSaved" />
  </main>
</template>

<style scoped>
.home-page { color: #172d49; }
.gallery-shell { width: min(1180px, calc(100% - 40px)); margin: -32px auto 0; position: relative; z-index: 2; padding: 35px 45px 68px; background: #fff; border-radius: 30px 30px 0 0; box-shadow: 0 -12px 45px rgb(53 125 169 / 10%); }
.section-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 25px; }
.section-kicker { margin: 0 0 8px; color: #2ca48e; font-size: 11px; font-weight: 750; letter-spacing: .16em; }
.section-header h2 { margin: 0 0 7px; color: #152b42; font-size: 28px; letter-spacing: -.02em; }
.section-header p:last-child { margin: 0; color: #94a0ad; font-size: 13px; }
.outline-button, .primary-button, .secondary-button { min-height: 37px; padding: 0 15px; font: inherit; font-size: 13px; border-radius: 7px; cursor: pointer; }
.outline-button { color: #2c8c84; background: #fff; border: 1px solid #b6e4dc; }
.primary-button { color: #fff; background: #238f83; border: 1px solid #238f83; }
.secondary-button { color: #517083; background: #fff; border: 1px solid #d8e4e9; }
.login-empty { display: flex; align-items: center; gap: 17px; padding: 24px; background: #f7fbfa; border: 1px dashed #b9e3db; border-radius: 13px; }
.empty-icon { display: grid; width: 42px; height: 42px; color: #fff; font-size: 20px; place-items: center; background: #53b9aa; border-radius: 13px; }
.login-empty strong { color: #1e3f4b; font-size: 15px; }
.login-empty span { flex: 1; color: #8a9da4; font-size: 13px; }
.search-box { display: flex; width: 230px; border: 1px solid #e1ebed; border-radius: 8px; }
.search-box input { min-width: 0; flex: 1; padding: 9px 11px; color: #294353; font: inherit; font-size: 13px; border: 0; outline: 0; }
.search-box button { width: 39px; color: #4e8d92; font-size: 18px; background: #f4fbfa; border: 0; border-left: 1px solid #e1ebed; cursor: pointer; }
@media (max-width: 900px) { .gallery-shell { padding: 30px 24px 56px; } }
@media (max-width: 620px) { .gallery-shell { width: 100%; margin-top: 0; border-radius: 0; } .section-header { align-items: flex-start; flex-direction: column; } .login-empty { align-items: flex-start; flex-wrap: wrap; } .login-empty span { flex-basis: calc(100% - 60px); } .login-empty .primary-button { margin-left: 59px; } .search-box { width: 100%; } }
</style>
