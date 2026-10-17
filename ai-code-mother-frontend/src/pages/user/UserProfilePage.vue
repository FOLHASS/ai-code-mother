<script setup lang="ts">
/**
 * 个人资料页面只负责组合标题、资料摘要和编辑表单。
 * 登录 store 提供摘要的数据源，ProfileEditor 自己管理编辑草稿及保存状态，避免页面重复维护表单。
 * 编辑成功更新同一 store 后，传给 ProfileSummary 的 user 会随响应式数据同步变化。
 */
import { useProfileEditorController } from '@/app/controllers.ts'
import PageHeader from '@/components/PageHeader.vue'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'
import { ProfileEditor } from '@/features/user-management/components'
import { ProfileSummary } from '@/features/user-management/components'

// 路由的登录守卫在进入本页前获取身份；这里读取共享资料用于展示。
const loginUserStore = useLoginUserStore()
const editor = useProfileEditorController()
</script>
<template>
  <section class="profile-page">
    <PageHeader
      eyebrow="PERSONAL SPACE"
      title="个人信息"
      description="管理你的平台资料，让 AI 更好地了解你的创作身份。"
    >
      <template #actions
        ><span class="account-status"><i></i>账号正常</span></template
      >
    </PageHeader>

    <div class="profile-layout">
      <ProfileSummary :user="loginUserStore.loginUser" />

      <ProfileEditor :controller="editor" />
    </div>
  </section>
</template>

<style scoped>
/* 页面整体限制最大宽度，保留左右留白并在主布局中居中。 */
.profile-page {
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
  color: #1f2d3d;
}

.account-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 11px;
  color: #318866;
  font-size: 12px;
  background: #f0fbf6;
  border: 1px solid #d6f1e4;
  border-radius: 999px;
}

.account-status i {
  width: 7px;
  height: 7px;
  background: #35b77e;
  border-radius: 50%;
}

/* 桌面左侧固定宽度摘要，右侧表单占据剩余空间；minmax 防止表单撑破网格。 */
.profile-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 20px;
}

/* 窄屏把摘要和编辑表单改为上下排列，不改变两块内容的状态归属。 */
@media (max-width: 760px) {
  .profile-layout {
    grid-template-columns: 1fr;
  }
}
</style>
