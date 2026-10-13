<script setup lang="ts">
import { computed } from 'vue'

import UserAvatar from '@/components/UserAvatar.vue'
import { formatDateTime } from '@/utils/app.ts'

type UserRole = 'user' | 'admin' | 'ban'
const props = defineProps<{ user: API.LoginUserVO }>()
const roleLabels: Record<UserRole, string> = {
  user: '普通用户',
  admin: '管理员',
  ban: '已封禁',
}
const displayName = computed(() => props.user.userName || props.user.userAccount || '用户')
const roleLabel = computed(() => {
  const role = props.user.userRole
  return role && role in roleLabels ? roleLabels[role as UserRole] : '普通用户'
})
const formatDate = (date?: string) => formatDateTime(date, '暂无记录')
</script>

<template>
  <aside class="profile-summary">
    <UserAvatar class="avatar-wrap" :avatar="user.userAvatar" :name="displayName" size="lg" />
    <h2>{{ displayName }}</h2>
    <p class="account-text">@{{ user.userAccount || '未设置账号' }}</p>
    <span class="role-badge" :class="`role-${user.userRole || 'user'}`">
      {{ roleLabel }}
    </span>

    <dl class="summary-list">
      <div>
        <dt>用户 ID</dt>
        <dd>{{ user.id || '-' }}</dd>
      </div>
      <div>
        <dt>注册时间</dt>
        <dd>{{ formatDate(user.createTime) }}</dd>
      </div>
      <div>
        <dt>最近更新</dt>
        <dd>{{ formatDate(user.updateTime) }}</dd>
      </div>
    </dl>
  </aside>
</template>

<style scoped>
h2,
p {
  margin-top: 0;
}

.profile-summary {
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
  margin: 0 auto 16px;
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

@media (max-width: 760px) {
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
</style>
