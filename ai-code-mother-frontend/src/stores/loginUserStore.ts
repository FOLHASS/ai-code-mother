/**
 * 跨页面共享的登录用户状态：导航、权限提示、个人资料展示都读取同一份数据。
 * Store 只管理客户端状态；真正的数据访问权限仍由后端接口校验。
 */
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getLoginUser } from '@/api/userController.ts'

export const useLoginUserStore = defineStore('loginUser', () => {
  // 初始对象没有 id，可通过是否存在 id 区分未登录与已登录用户。
  const loginUser = ref<API.LoginUserVO>({
    userName: '未登录',
  })
  // 表示一次登录态探测已完成，不代表一定登录成功，也不是进行中请求的锁。
  const isInitialized = ref(false)

  // 获取登录用户信息
  /** 已完成探测时直接返回；网络错误向调用方抛出，成功响应后才标记为已初始化。 */
  async function fetchLoginUser() {
    if (isInitialized.value) {
      return
    }

    const res = await getLoginUser()

    // 只有业务成功且存在用户数据时覆盖默认用户；未登录响应仍算完成一次探测。
    if (res.data.code === 0 && res.data.data) {
      loginUser.value = res.data.data
    }
    isInitialized.value = true
  }

  /** 登录、退出或个人资料更新后替换共享用户对象；不会额外请求后端。 */
  function setLoginUser(user: API.LoginUserVO) {
    loginUser.value = user
  }

  // 对外暴露状态与更新方法，页面不需要分别维护一份登录用户副本。
  return { loginUser, fetchLoginUser, setLoginUser, isInitialized }
})
