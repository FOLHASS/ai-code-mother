import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getLoginUser } from '@/api/userController.ts'

export const useLoginUserStore = defineStore('loginUser', () => {
  const loginUser = ref<API.LoginUserVO>({
    userName: '未登录',
  })
  const isInitialized = ref(false)

  // 获取登录用户信息
  async function fetchLoginUser() {
    if (isInitialized.value) {
      return
    }

    const res = await getLoginUser()

    if (res.data.code === 0 && res.data.data) {
      loginUser.value = res.data.data
    }
    isInitialized.value = true
  }

  function setLoginUser(user: API.LoginUserVO) {
    loginUser.value = user
  }

  return { loginUser, fetchLoginUser, setLoginUser, isInitialized }
})
