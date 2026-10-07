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
          path: 'app/:id',
          name: 'AppChatPage',
          component: () => import('@/pages/AppChatPage.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'app/edit/:id',
          name: 'AppEditPage',
          component: () => import('@/pages/AppEditPage.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'admin/appManage',
          name: 'AdminAppManagePage',
          component: () => import('@/pages/admin/AppManagePage.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/userManage',
          name: 'AdminUserManagePage',
          component: () => import('@/pages/admin/UserManagePage.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/chatHistoryManage',
          name: 'AdminChatHistoryManagePage',
          component: () => import('@/pages/admin/ChatHistoryManagePage.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'user/profile',
          name: 'UserProfilePage',
          component: () => import('@/pages/user/UserProfilePage.vue'),
          meta: { requiresAuth: true },
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

  if (to.meta.requiresAuth && !loginUserStore.loginUser.id) {
    return {
      name: 'loginPage',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.requiresAdmin && loginUserStore.loginUser.userRole !== 'admin') {
    return {
      path: '/',
      query: { forbidden: 'admin' },
    }
  }

  return true
})

export default router
