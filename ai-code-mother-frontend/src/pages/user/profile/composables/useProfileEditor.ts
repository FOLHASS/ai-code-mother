import { reactive, ref } from 'vue'
import { message } from 'ant-design-vue'

import { updateUser } from '@/api/userController.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

/** 编辑草稿只在个人资料表单中维护，保存成功后更新共享的登录用户。 */
/**
 * 个人资料编辑逻辑入口，每次调用创建独立的表单草稿和保存状态。
 * 返回 profileForm 供表单绑定、isSaving 控制禁用状态、resetForm 恢复共享资料、handleSave 提交修改。
 * 本模块负责接口成功后的 store 同步，展示组件只消费返回的状态与动作。
 */
export function useProfileEditor() {
  const loginUserStore = useLoginUserStore()
  // 加载状态只属于这次资料保存，供输入框和两种操作按钮共用。
  const isSaving = ref(false)
  // 只维护可编辑的昵称、头像 URL 和简介，用户 ID 在提交时取自当前登录身份。
  const profileForm = reactive<API.UserUpdateRequest>({
    userName: '',
    userAvatar: '',
    userProfile: '',
  })

  /**
   * 把当前登录 store 的字段拷贝到草稿，缺省字段转为空字符串便于表单绑定。
   * 通过字段赋值保留 reactive 对象引用；恢复原值不会发送请求，也不会修改 store。
   */
  const resetForm = () => {
    profileForm.userName = loginUserStore.loginUser.userName || ''
    profileForm.userAvatar = loginUserStore.loginUser.userAvatar || ''
    profileForm.userProfile = loginUserStore.loginUser.userProfile || ''
  }

  // 组合函数创建时先回填一次；后续点击“恢复原值”会再次读取当前 store。
  resetForm()

  /**
   * 保存当前草稿：先确认登录 ID 和非空昵称，成功后将规范化字段合并到共享登录资料。
   * 头像和简介的空白字符串会作为 undefined 传递；真实字段约束与权限由后端接口执行。
   * 表单简介中的“最多 200 字”是界面提示，此方法当前未额外做长度校验。
   */
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
      // ID 使用当前登录用户，昵称先去首尾空格；只提交该表单负责的字段。
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

      // 响应返回的是操作结果，因此以已有用户资料加本次字段更新 store，保留账号、角色等其他信息。
      loginUserStore.setLoginUser({
        ...loginUserStore.loginUser,
        userName: profileForm.userName.trim(),
        userAvatar: profileForm.userAvatar?.trim() || undefined,
        userProfile: profileForm.userProfile?.trim() || undefined,
      })
      message.success('个人信息已保存')
    } catch {
      message.error('网络异常，个人信息保存失败')
    // 业务失败的提前返回也会经过 finally，避免表单长期处于保存中。
    } finally {
      isSaving.value = false
    }
  }
  // 向组件暴露一份草稿和配套动作，避免展示层自行重复请求或同步登录资料。
  return { profileForm, isSaving, resetForm, handleSave }
}
