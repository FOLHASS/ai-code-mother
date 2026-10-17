<!-- 首页只组装提示词、作品和精选区域；请求状态与卡片操作由页面控制器负责。 -->
<script setup lang="ts">
import { useHomeControllers } from '@/app/controllers.ts'
import { AppEditModal } from '@/features/app-management/components'
import { HomePromptHero } from '@/features/home/components'
import { AppGallerySection } from '@/features/home/components'

// 两套列表共享展示组件，各自保留当前页、总数、加载状态；编辑成功事件交回控制器同步名称。
const { appsController, pageController, editController } = useHomeControllers()
const {
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
  searchGoodApps,
  changeMyPage,
  changeGoodPage,
} = appsController
const {
  router,
  isCreating,
  showEditModal,
  displayName,
  submitPrompt,
  openApp,
  editApp,
  removeApp,
} = pageController
</script>

<template>
  <main class="home-page">
    <HomePromptHero :is-creating="isCreating" @create="submitPrompt" />

    <section class="gallery-shell">
      <AppGallerySection
        :apps="myApps"
        :total="myTotal"
        :page="myPage"
        :page-size="pageSize"
        :loading="isMyLoading"
        :logged-out="!isLoggedIn"
        empty-text="还没有应用，从上面的输入框开始创建吧。"
        @open="openApp"
        @edit="editApp"
        @remove="removeApp"
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
            <button
              v-if="!isLoggedIn"
              class="outline-button"
              type="button"
              @click="router.push('/user/login')"
            >
              登录查看
            </button>
          </div>
        </template>
        <template #logged-out>
          <div class="login-empty">
            <div class="empty-icon">✦</div>
            <strong>登录后开始你的创作</strong><span>你的应用、对话和迭代记录都会保存在这里</span>
            <button class="primary-button" type="button" @click="router.push('/user/login')">
              去登录
            </button>
          </div>
        </template>
      </AppGallerySection>

      <AppGallerySection
        :apps="goodApps"
        :total="goodTotal"
        :page="goodPage"
        :page-size="pageSize"
        :loading="isGoodLoading"
        variant="featured"
        empty-text="暂时没有匹配的精选应用。"
        @open="openApp"
        @page-change="changeGoodPage"
      >
        <template #header>
          <div class="section-header">
            <div>
              <p class="section-kicker">CURATED SHOWCASE</p>
              <h2>精选案例</h2>
              <p>看看社区里正在发生的好想法</p>
            </div>
            <form class="search-box" @submit.prevent="searchGoodApps">
              <input
                v-model="goodSearch"
                type="search"
                placeholder="搜索应用名称"
                aria-label="搜索精选应用"
              /><button type="submit" aria-label="搜索">⌕</button>
            </form>
          </div>
        </template>
      </AppGallerySection>
    </section>
    <AppEditModal :open="showEditModal" :controller="editController" />
  </main>
</template>

<style scoped>
/* 首页底色与正文色；画廊用负上边距覆盖 Hero 下沿，并通过层级保持白色内容面板在上方。 */
.home-page {
  color: #172d49;
}
.gallery-shell {
  width: min(1180px, calc(100% - 40px));
  margin: -32px auto 0;
  position: relative;
  z-index: 2;
  padding: 35px 45px 68px;
  background: #fff;
  border-radius: 30px 30px 0 0;
  box-shadow: 0 -12px 45px rgb(53 125 169 / 10%);
}
/* 作品分区标题与右侧操作横向对齐；搜索框和未登录引导由首页插槽提供。 */
.section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 25px;
}
.section-kicker {
  margin: 0 0 8px;
  color: #2ca48e;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.16em;
}
.section-header h2 {
  margin: 0 0 7px;
  color: #152b42;
  font-size: 28px;
  letter-spacing: -0.02em;
}
.section-header p:last-child {
  margin: 0;
  color: #94a0ad;
  font-size: 13px;
}
.outline-button,
.primary-button,
.secondary-button {
  min-height: 37px;
  padding: 0 15px;
  font: inherit;
  font-size: 13px;
  border-radius: 7px;
  cursor: pointer;
}
.outline-button {
  color: #2c8c84;
  background: #fff;
  border: 1px solid #b6e4dc;
}
.primary-button {
  color: #fff;
  background: #238f83;
  border: 1px solid #238f83;
}
.secondary-button {
  color: #517083;
  background: #fff;
  border: 1px solid #d8e4e9;
}
/* 未登录占位提供创作说明和登录入口，沿用卡片区宽度，避免与真正的空作品列表混淆。 */
.login-empty {
  display: flex;
  align-items: center;
  gap: 17px;
  padding: 24px;
  background: #f7fbfa;
  border: 1px dashed #b9e3db;
  border-radius: 13px;
}
.empty-icon {
  display: grid;
  width: 42px;
  height: 42px;
  color: #fff;
  font-size: 20px;
  place-items: center;
  background: #53b9aa;
  border-radius: 13px;
}
.login-empty strong {
  color: #1e3f4b;
  font-size: 15px;
}
.login-empty span {
  flex: 1;
  color: #8a9da4;
  font-size: 13px;
}
.search-box {
  display: flex;
  width: 230px;
  border: 1px solid #e1ebed;
  border-radius: 8px;
}
.search-box input {
  min-width: 0;
  flex: 1;
  padding: 9px 11px;
  color: #294353;
  font: inherit;
  font-size: 13px;
  border: 0;
  outline: 0;
}
.search-box button {
  width: 39px;
  color: #4e8d92;
  font-size: 18px;
  background: #f4fbfa;
  border: 0;
  border-left: 1px solid #e1ebed;
  cursor: pointer;
}
/* 平板收紧画廊内边距；窄屏取消外侧留白，标题、搜索与登录引导按可用宽度换行。 */
@media (max-width: 900px) {
  .gallery-shell {
    padding: 30px 24px 56px;
  }
}
@media (max-width: 620px) {
  .gallery-shell {
    width: 100%;
    margin-top: 0;
    border-radius: 0;
  }
  .section-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .login-empty {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .login-empty span {
    flex-basis: calc(100% - 60px);
  }
  .login-empty .primary-button {
    margin-left: 59px;
  }
  .search-box {
    width: 100%;
  }
}
</style>
