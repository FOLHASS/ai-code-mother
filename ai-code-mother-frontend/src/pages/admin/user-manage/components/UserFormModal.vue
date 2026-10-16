<script setup lang="ts">
/**
 * 创建与编辑用户共用的表单弹窗：本地维护草稿，Props 决定模式、开关、加载态和待编辑用户。
 * 窗口打开时回填或重置草稿；提交只触发 submit，取消只触发 close，请求和关闭策略由父级负责。
 * 创建模式展示账号字段及认证配置说明；编辑模式携带用户 ID，并不允许修改账号。
 */
import { reactive, watch } from 'vue'
import { Modal } from 'ant-design-vue'

// 复用生成接口类型的交集，覆盖创建与编辑两个模式需要的字段集合。
type UserForm = API.UserAddRequest & API.UserUpdateRequest

// 父级拥有弹窗开关与提交状态，user 缺省为空，组件不会直接修改任何 Props。
const props = withDefaults(
  defineProps<{
    open: boolean
    // mode 同时决定标题、确认文案、回填方式和提交字段。
    mode: 'create' | 'edit'
    loading: boolean
    user?: API.UserVO | null
  }>(),
  { user: null },
)

// close 由父级决定是否允许关闭；submit 发送整理后的表单数据交给 CRUD 组合函数。
const emit = defineEmits<{
  close: []
  submit: [form: UserForm]
}>()

// 独立草稿隔离输入与列表对象，取消编辑时不会把尚未保存的值写回表格。
const form = reactive<UserForm>({
  userAccount: '',
  userName: '',
  userAvatar: '',
  userProfile: '',
  userRole: 'user',
})

/**
 * 同时监听打开状态和选中用户引用；仅打开时更新表单，immediate 兼容初始就打开的场景。
 * 创建模式清空 ID 与资料并默认普通用户；编辑模式只拷贝接口允许修改的字段。
 * 这里只负责回填，必填校验与后端提交由父级提供的处理方法执行。
 */
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

/**
 * 按模式显式组装提交字段，避免旧草稿中与当前模式无关的数据泄漏到请求。
 * 创建发送账号及资料；编辑发送 ID 及资料，不发送账号；本方法不直接关闭窗口。
 */
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

/* 弹窗中的输入、角色选择和简介统一尺寸与边框，保留各原生控件自身的输入语义。 */
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

/* 字段按纵向网格排列，弹窗宽度由 Ant Design Vue Modal 管理。 */
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

/* 创建模式底部的辅助说明单独降低视觉权重，与表单字段保持间距。 */
.form-tip {
  margin: -4px 0 0;
  color: #8b99aa;
  font-size: 12px;
  line-height: 1.6;
}
</style>
