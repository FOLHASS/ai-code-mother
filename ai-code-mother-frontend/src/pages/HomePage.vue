<!--
  首页负责组合提示词创建区、我的作品区和精选案例区；实际请求与分页状态由 useHomeApps 持有。
  页面接收子组件的创建、查看、编辑和删除事件，并协调路由跳转、确认弹窗与名称编辑弹窗。
-->
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

// 路由用于登录引导和进入应用对话；登录 Store 提供当前用户身份，避免组件各自维护用户副本。
const router = useRouter()
const loginUserStore = useLoginUserStore()
// 创建中的状态由页面持有并传给输入组件，使请求期间的输入框与提交按钮保持一致。
const isCreating = ref(false)
// 两套列表共享展示组件，各自保留当前页、总数、加载状态；编辑成功事件交回 Composable 同步名称。
const {
  isLoggedIn, isMyLoading, isGoodLoading, myApps, goodApps, myTotal, goodTotal,
  myPage, goodPage, pageSize, goodSearch, loadMyApps, searchGoodApps,
  handleAppSaved, changeMyPage, changeGoodPage,
} = useHomeApps()
// 当前编辑对象与弹窗显隐分开保存；打开时传入卡片数据，保存后由 saved 事件更新列表。
const editingApp = ref<API.AppVO | null>(null)
const showEditModal = ref(false)

// 首页欢迎文案优先展示昵称，其次账号；用户信息尚未提供这两个字段时使用统一称呼。
const displayName = computed(
  () => loginUserStore.loginUser.userName || loginUserStore.loginUser.userAccount || '创作者',
)

/**
 * 接收提示词组件的原始输入，去除首尾空白后创建应用，再携带后端生成的 ID 进入对话页面。
 * 此处只创建应用；首次生成及对话历史判断由对话页面接管，避免首页重复发起生成请求。
 */
const submitPrompt = async (prompt: string) => {
  const initPrompt = prompt.trim()
  if (!initPrompt) {
    message.warning('先描述你想创建的网站')
    return
  }
  // 未登录先跳转登录页，并保留返回首页的地址；本次输入不会在这里继续调用创建接口。
  if (!isLoggedIn.value) {
    await router.push({ path: '/user/login', query: { redirect: '/' } })
    return
  }
  isCreating.value = true
  try {
    // 同时检查业务状态码和返回 ID；HTTP 请求完成并不代表业务创建成功。
    const response = await addApp({ initPrompt })
    if (response.data.code !== 0 || !response.data.data) {
      message.error(response.data.message || '应用创建失败')
      return
    }
    await router.push(`/app/${response.data.data}`)
  } catch {
    message.error('网络异常，应用创建失败')
  // 包括业务失败提前返回、网络异常和跳转完成，都要释放输入区的创建状态。
  } finally {
    isCreating.value = false
  }
}

// 卡片“查看对话”和卡片主体复用此入口；缺少 ID 时不拼接无效路由。
const openApp = (app: API.AppVO) => {
  if (app.id) void router.push(`/app/${app.id}`)
}

// “我的作品”只允许本人编辑；ID 转为字符串比较，兼容前后端长整型 ID 的表示差异。
const editApp = (app: API.AppVO) => {
  if (!app.id) return
  if (!isLoggedIn.value || String(app.userId) !== String(loginUserStore.loginUser.id)) {
    message.warning('只能编辑自己的作品')
    return
  }
  editingApp.value = app
  showEditModal.value = true
}

// 删除需用户确认后才请求后端；确认框使用应用名称提示影响范围，真正权限由后端再次校验。
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
        // 当前页最后一项删除后退到上一页，避免停留在已不存在的空页，再刷新“我的作品”。
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
/* 首页底色与正文色；画廊用负上边距覆盖 Hero 下沿，并通过层级保持白色内容面板在上方。 */
.home-page { color: #172d49; }
.gallery-shell { width: min(1180px, calc(100% - 40px)); margin: -32px auto 0; position: relative; z-index: 2; padding: 35px 45px 68px; background: #fff; border-radius: 30px 30px 0 0; box-shadow: 0 -12px 45px rgb(53 125 169 / 10%); }
/* 作品分区标题与右侧操作横向对齐；搜索框和未登录引导由首页插槽提供。 */
.section-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 25px; }
.section-kicker { margin: 0 0 8px; color: #2ca48e; font-size: 11px; font-weight: 750; letter-spacing: .16em; }
.section-header h2 { margin: 0 0 7px; color: #152b42; font-size: 28px; letter-spacing: -.02em; }
.section-header p:last-child { margin: 0; color: #94a0ad; font-size: 13px; }
.outline-button, .primary-button, .secondary-button { min-height: 37px; padding: 0 15px; font: inherit; font-size: 13px; border-radius: 7px; cursor: pointer; }
.outline-button { color: #2c8c84; background: #fff; border: 1px solid #b6e4dc; }
.primary-button { color: #fff; background: #238f83; border: 1px solid #238f83; }
.secondary-button { color: #517083; background: #fff; border: 1px solid #d8e4e9; }
/* 未登录占位提供创作说明和登录入口，沿用卡片区宽度，避免与真正的空作品列表混淆。 */
.login-empty { display: flex; align-items: center; gap: 17px; padding: 24px; background: #f7fbfa; border: 1px dashed #b9e3db; border-radius: 13px; }
.empty-icon { display: grid; width: 42px; height: 42px; color: #fff; font-size: 20px; place-items: center; background: #53b9aa; border-radius: 13px; }
.login-empty strong { color: #1e3f4b; font-size: 15px; }
.login-empty span { flex: 1; color: #8a9da4; font-size: 13px; }
.search-box { display: flex; width: 230px; border: 1px solid #e1ebed; border-radius: 8px; }
.search-box input { min-width: 0; flex: 1; padding: 9px 11px; color: #294353; font: inherit; font-size: 13px; border: 0; outline: 0; }
.search-box button { width: 39px; color: #4e8d92; font-size: 18px; background: #f4fbfa; border: 0; border-left: 1px solid #e1ebed; cursor: pointer; }
/* 平板收紧画廊内边距；窄屏取消外侧留白，标题、搜索与登录引导按可用宽度换行。 */
@media (max-width: 900px) { .gallery-shell { padding: 30px 24px 56px; } }
@media (max-width: 620px) { .gallery-shell { width: 100%; margin-top: 0; border-radius: 0; } .section-header { align-items: flex-start; flex-direction: column; } .login-empty { align-items: flex-start; flex-wrap: wrap; } .login-empty span { flex-basis: calc(100% - 60px); } .login-empty .primary-button { margin-left: 59px; } .search-box { width: 100%; } }
</style>
