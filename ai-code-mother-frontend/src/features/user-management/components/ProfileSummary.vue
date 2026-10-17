<script setup lang="ts">
import type { SessionUser } from '@/shared/domain/models.ts'
/**
 * 只读用户摘要：接收登录用户资料，展示头像、名称、账号、角色以及时间字段。
 * 父页面负责提供 user，编辑表单保存后通过同一 store 驱动这里更新；本组件没有保存或请求行为。
 * 名称、角色文案和日期均通过派生值或格式化函数处理，模板专注展示。
 */
import { computed } from 'vue'

import UserAvatar from '@/components/UserAvatar.vue'
import { formatDateTime } from '@/utils/app.ts'

// 本地类型对应已支持的角色文案键；未知或缺少角色在摘要中回退为普通用户。
type UserRole = 'user' | 'admin' | 'ban'
// 用户资料由父页面传入，组件不修改 Props。
const props = defineProps<{ user: SessionUser }>()
const roleLabels: Record<UserRole, string> = {
  user: '普通用户',
  admin: '管理员',
  ban: '已封禁',
}
// 名称依次取昵称、账号和通用占位，确保头像与标题使用同一个显示名。
const displayName = computed(() => props.user.userName || props.user.userAccount || '用户')
// 角色映射只影响文案展示，不承担管理员权限判断。
const roleLabel = computed(() => {
  const role = props.user.userRole
  return role && role in roleLabels ? roleLabels[role as UserRole] : '普通用户'
})
// 复用公共时间格式化；缺少日期时在资料摘要中展示“暂无记录”。
/** 把日期值格式化为界面使用的日期文本。 */
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

/* 摘要卡片的边框、圆角和阴影与右侧资料表单保持一致。 */
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

/* 角色徽标的基础形状共用，颜色由 role-user、role-admin、role-ban 类区分。 */
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

/* 每项详情使用名称和值两端对齐，日期与 ID 保持独立阅读位置。 */
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

/* 窄屏摘要变成头像与文本并排，详细资料占满下一行，适应页面单列布局。 */
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
