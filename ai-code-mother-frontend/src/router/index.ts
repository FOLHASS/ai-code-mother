import { createRouter, createWebHistory } from 'vue-router'

import { useLoginUserStore } from '@/stores/loginUserStore.ts'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/BasicLayout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/pages/HomePage.vue'),
        },
        {
          path: 'algorithm',
          name: 'algorithm',
          component: () => import('@/pages/AlgorithmPage.vue'),
        },
        {
          path: 'admin/userManage',
          name: 'AdminUserManagePage',
          component: () => import('@/pages/admin/UserManagePage.vue'),
        },
        {
          path: 'user/profile',
          name: 'UserProfilePage',
          component: () => import('@/pages/user/UserProfilePage.vue'),
        },
      ],
    },
    {
      path: '/user',
      component: () => import('@/layouts/AuthLayout.vue'),
      children: [
        {
          path: 'login',
          name: 'loginPage',
          component: () => import('@/pages/user/UserLoginPage.vue'),
        },
        {
          path: 'register',
          name: 'registerPage',
          component: () => import('@/pages/user/UserRegisterPage.vue'),
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const loginUserStore = useLoginUserStore()
  await loginUserStore.fetchLoginUser()

  if (to.name !== 'AdminUserManagePage') {
    return true
  }

  if (loginUserStore.loginUser.userRole !== 'admin') {
    return {
      path: '/',
      query: { forbidden: 'admin' },
    }
  }

  return true
})

export default router
