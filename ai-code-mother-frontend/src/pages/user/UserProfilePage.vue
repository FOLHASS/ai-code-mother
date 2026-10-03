<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'

import { updateUser } from '@/api/userController.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

type UserRole = 'user' | 'admin' | 'ban'

const loginUserStore = useLoginUserStore()
const isSaving = ref(false)

const profileForm = reactive<API.UserUpdateRequest>({
  userName: '',
  userAvatar: '',
  userProfile: '',
})

const roleLabels: Record<UserRole, string> = {
  user: '普通用户',
  admin: '管理员',
  ban: '已封禁',
}

const displayName = computed(
  () => loginUserStore.loginUser.userName || loginUserStore.loginUser.userAccount || '用户',
)
const roleLabel = computed(() => {
  const role = loginUserStore.loginUser.userRole
  return role && role in roleLabels ? roleLabels[role as UserRole] : '普通用户'
})
const avatarFallback = computed(() => displayName.value.slice(0, 1).toUpperCase())

const formatDate = (date?: string) => {
  if (!date) return '暂无记录'
  const parsedDate = new Date(date)
  return Number.isNaN(parsedDate.getTime()) ? date : parsedDate.toLocaleString('zh-CN')
}

const resetForm = () => {
  profileForm.userName = loginUserStore.loginUser.userName || ''
  profileForm.userAvatar = loginUserStore.loginUser.userAvatar || ''
  profileForm.userProfile = loginUserStore.loginUser.userProfile || ''
}

resetForm()

const handleSave = async () => {
  if (!loginUserStore.loginUser.id) {
    message.warning('当前登录状态已失效，请重新登录')
    return
  }

  if (!profileForm.userName?.trim()) {
    message.warning('请输入用户昵称')
    return
  }

  isSaving.value = true
  try {
    const response = await updateUser({
      id: loginUserStore.loginUser.id,
      userName: profileForm.userName.trim(),
      userAvatar: profileForm.userAvatar?.trim() || undefined,
      userProfile: profileForm.userProfile?.trim() || undefined,
    })

    if (response.data.code !== 0 || !response.data.data) {
      message.error(response.data.message || '个人信息保存失败')
      return
    }

    loginUserStore.setLoginUser({
      ...loginUserStore.loginUser,
      userName: profileForm.userName.trim(),
      userAvatar: profileForm.userAvatar?.trim() || undefined,
      userProfile: profileForm.userProfile?.trim() || undefined,
    })
    message.success('个人信息已保存')
  } catch {
    message.error('网络异常，个人信息保存失败')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <section class="profile-page">
    <header class="page-header">
      <div>
        <p class="page-eyebrow">PERSONAL SPACE</p>
        <h1>个人信息</h1>
        <p>管理你的平台资料，让 AI 更好地了解你的创作身份。</p>
      </div>
      <span class="account-status"><i></i>账号正常</span>
    </header>

    <div class="profile-layout">
      <aside class="profile-summary">
        <div class="avatar-wrap">
          <img
            v-if="loginUserStore.loginUser.userAvatar"
            :src="loginUserStore.loginUser.userAvatar"
            :alt="`${displayName}的头像`"
          />
          <span v-else>{{ avatarFallback }}</span>
        </div>
        <h2>{{ displayName }}</h2>
        <p class="account-text">@{{ loginUserStore.loginUser.userAccount || '未设置账号' }}</p>
        <span class="role-badge" :class="`role-${loginUserStore.loginUser.userRole || 'user'}`">
          {{ roleLabel }}
        </span>

        <dl class="summary-list">
          <div>
            <dt>用户 ID</dt>
            <dd>{{ loginUserStore.loginUser.id || '-' }}</dd>
          </div>
          <div>
            <dt>注册时间</dt>
            <dd>{{ formatDate(loginUserStore.loginUser.createTime) }}</dd>
          </div>
          <div>
            <dt>最近更新</dt>
            <dd>{{ formatDate(loginUserStore.loginUser.updateTime) }}</dd>
          </div>
        </dl>
      </aside>

      <section class="profile-form-panel" aria-label="编辑个人信息">
        <div class="section-heading">
          <div>
            <h2>资料设置</h2>
            <p>以下信息会展示在你的平台资料中。</p>
          </div>
          <span class="edit-mark">EDIT PROFILE</span>
        </div>

        <form class="profile-form" @submit.prevent="handleSave">
          <label class="field-item">
            <span>用户昵称</span>
            <input v-model="profileForm.userName" type="text" placeholder="请输入用户昵称" :disabled="isSaving" />
          </label>
          <label class="field-item">
            <span>头像地址</span>
            <input v-model="profileForm.userAvatar" type="url" placeholder="请输入头像图片 URL" :disabled="isSaving" />
          </label>
          <label class="field-item">
            <span>个人简介</span>
            <textarea v-model="profileForm.userProfile" rows="6" placeholder="介绍一下你自己，最多 200 字" :disabled="isSaving"></textarea>
          </label>

          <div class="form-footer">
            <button class="secondary-button" type="button" :disabled="isSaving" @click="resetForm">恢复原值</button>
            <button class="primary-button" type="submit" :disabled="isSaving">
              {{ isSaving ? '保存中...' : '保存修改' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped>
.profile-page {
  color: #1f2d3d;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.page-eyebrow {
  margin: 0 0 8px;
  color: #3478d4;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 8px;
  color: #152b46;
  font-size: 30px;
}

.page-header p:last-child {
  margin-bottom: 0;
  color: #728196;
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

.profile-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 20px;
}

.profile-summary,
.profile-form-panel {
  background: #fff;
  border: 1px solid #e4edf6;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(42 92 145 / 5%);
}

.profile-summary {
  padding: 28px 24px;
  text-align: center;
}

.avatar-wrap {
  width: 88px;
  height: 88px;
  margin: 0 auto 16px;
  overflow: hidden;
  border: 4px solid #edf5ff;
  border-radius: 50%;
}

.avatar-wrap img,
.avatar-wrap span {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
}

.avatar-wrap img {
  object-fit: cover;
}

.avatar-wrap span {
  color: #2679d9;
  font-size: 30px;
  font-weight: 700;
  background: #e8f2ff;
}

.profile-summary h2 {
  margin-bottom: 6px;
  color: #20334f;
  font-size: 20px;
}

.account-text {
  margin-bottom: 14px;
  color: #8a99aa;
  font-size: 13px;
}

.role-badge {
  display: inline-flex;
  padding: 4px 9px;
  font-size: 11px;
  border-radius: 999px;
}

.role-user {
  color: #3478a9;
  background: #edf7ff;
}

.role-admin {
  color: #6e56b4;
  background: #f3efff;
}

.role-ban {
  color: #c04d5f;
  background: #fff0f2;
}

.summary-list {
  margin: 28px 0 0;
  text-align: left;
}

.summary-list div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid #edf2f7;
}

.summary-list dt {
  color: #8492a6;
  font-size: 12px;
}

.summary-list dd {
  margin: 0;
  color: #455970;
  font-size: 12px;
  text-align: right;
}

.profile-form-panel {
  padding: 28px 32px;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 22px;
  border-bottom: 1px solid #edf2f7;
}

.section-heading h2 {
  margin-bottom: 7px;
  color: #20334f;
  font-size: 20px;
}

.section-heading p {
  margin-bottom: 0;
  color: #8a99aa;
  font-size: 13px;
}

.edit-mark {
  color: #9aabba;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.profile-form {
  display: grid;
  max-width: 640px;
  gap: 20px;
  padding-top: 24px;
}

.field-item {
  display: block;
}

.field-item > span {
  display: block;
  margin-bottom: 8px;
  color: #52647b;
  font-size: 13px;
  font-weight: 600;
}

.field-item input,
.field-item textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 11px 12px;
  color: #24364c;
  font: inherit;
  background: #fbfdff;
  border: 1px solid #d8e4ef;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.field-item input {
  height: 42px;
}

.field-item textarea {
  resize: vertical;
}

.field-item input:focus,
.field-item textarea:focus {
  border-color: #4a91e8;
  box-shadow: 0 0 0 3px rgb(74 145 232 / 11%);
}

.field-item input:disabled,
.field-item textarea:disabled,
button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}

.primary-button,
.secondary-button {
  height: 40px;
  padding: 0 16px;
  font: inherit;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
}

.primary-button {
  color: #fff;
  background: #2679d9;
  border: 1px solid #2679d9;
}

.primary-button:hover:not(:disabled) {
  background: #1768c5;
}

.secondary-button {
  color: #52647b;
  background: #fff;
  border: 1px solid #d8e4ef;
}

.secondary-button:hover:not(:disabled) {
  color: #2679d9;
  border-color: #8bb8e9;
}

@media (max-width: 760px) {
  .profile-layout {
    grid-template-columns: 1fr;
  }

  .profile-summary {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 16px;
    text-align: left;
  }

  .avatar-wrap {
    grid-row: span 3;
    margin: 0;
  }

  .profile-summary h2,
  .account-text,
  .role-badge {
    align-self: end;
  }

  .summary-list {
    grid-column: 1 / -1;
  }
}

@media (max-width: 480px) {
  .page-header,
  .section-heading {
    flex-direction: column;
  }

  .profile-form-panel {
    padding: 24px 20px;
  }

  .form-footer {
    justify-content: stretch;
  }

  .form-footer button {
    flex: 1;
  }
}
</style>
