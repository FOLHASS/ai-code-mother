<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Modal } from 'ant-design-vue'

type UserForm = API.UserAddRequest & API.UserUpdateRequest

const props = withDefaults(
  defineProps<{
    open: boolean
    mode: 'create' | 'edit'
    loading: boolean
    user?: API.UserVO | null
  }>(),
  { user: null },
)

const emit = defineEmits<{
  close: []
  submit: [form: UserForm]
}>()

const form = reactive<UserForm>({
  userAccount: '',
  userName: '',
  userAvatar: '',
  userProfile: '',
  userRole: 'user',
})

watch(
  [() => props.open, () => props.user],
  ([open]) => {
    if (!open) return
    Object.assign(
      form,
      props.mode === 'create'
        ? {
            id: undefined,
            userAccount: '',
            userName: '',
            userAvatar: '',
            userProfile: '',
            userRole: 'user',
          }
        : {
            id: props.user?.id,
            userName: props.user?.userName || '',
            userAvatar: props.user?.userAvatar || '',
            userProfile: props.user?.userProfile || '',
            userRole: props.user?.userRole || 'user',
          },
    )
  },
  { immediate: true },
)

const submit = () => {
  if (props.mode === 'create') {
    emit('submit', {
      userAccount: form.userAccount,
      userName: form.userName,
      userAvatar: form.userAvatar,
      userProfile: form.userProfile,
      userRole: form.userRole,
    })
  } else {
    emit('submit', {
      id: form.id,
      userName: form.userName,
      userAvatar: form.userAvatar,
      userProfile: form.userProfile,
      userRole: form.userRole,
    })
  }
}
</script>

<template>
  <Modal
    :open="open"
    :title="mode === 'create' ? '创建用户' : '编辑用户信息'"
    :confirm-loading="loading"
    :ok-text="mode === 'create' ? '创建用户' : '保存修改'"
    cancel-text="取消"
    @ok="submit"
    @cancel="emit('close')"
  >
    <div class="edit-form">
      <label v-if="mode === 'create'" class="field-item">
        <span>账号 <em>必填</em></span>
        <input v-model="form.userAccount" type="text" placeholder="请输入用户账号" />
      </label>
      <label class="field-item">
        <span>用户昵称</span>
        <input v-model="form.userName" type="text" placeholder="请输入用户昵称" />
      </label>
      <label class="field-item">
        <span>头像地址</span>
        <input v-model="form.userAvatar" type="url" placeholder="请输入头像 URL" />
      </label>
      <label class="field-item">
        <span>个人简介</span>
        <textarea v-model="form.userProfile" rows="4" placeholder="请输入个人简介"></textarea>
      </label>
      <label class="field-item">
        <span>用户角色</span>
        <select v-model="form.userRole">
          <option value="user">普通用户</option>
          <option value="admin">管理员</option>
          <option value="ban">已封禁</option>
        </select>
      </label>
      <p v-if="mode === 'create'" class="form-tip">
        创建用户时不设置密码，账号可由后续流程完成认证配置。
      </p>
    </div>
  </Modal>
</template>

<style scoped>
.field-item {
  display: block;
}

.field-item > span {
  display: block;
  margin-bottom: 7px;
  color: #52647b;
  font-size: 12px;
  font-weight: 600;
}

.field-item input,
.field-item select,
.field-item textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 9px 10px;
  color: #24364c;
  font: inherit;
  background: #fbfdff;
  border: 1px solid #d8e4ef;
  border-radius: 6px;
  outline: none;
}

.field-item input,
.field-item select {
  height: 38px;
}

.field-item textarea {
  resize: vertical;
}

.field-item input:focus,
.field-item select:focus,
.field-item textarea:focus {
  border-color: #4a91e8;
  box-shadow: 0 0 0 3px rgb(74 145 232 / 11%);
}

.edit-form {
  display: grid;
  gap: 16px;
}

.field-item em {
  margin-left: 4px;
  color: #d94b5b;
  font-size: 11px;
  font-style: normal;
  font-weight: 400;
}

.form-tip {
  margin: -4px 0 0;
  color: #8b99aa;
  font-size: 12px;
  line-height: 1.6;
}
</style>
