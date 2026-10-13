import { reactive, ref } from 'vue'
import { message } from 'ant-design-vue'

import { updateUser } from '@/api/userController.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

/** 编辑草稿只在个人资料表单中维护，保存成功后更新共享的登录用户。 */
export function useProfileEditor() {
  const loginUserStore = useLoginUserStore()
  const isSaving = ref(false)
  const profileForm = reactive<API.UserUpdateRequest>({
    userName: '',
    userAvatar: '',
    userProfile: '',
  })

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
  return { profileForm, isSaving, resetForm, handleSave }
}
