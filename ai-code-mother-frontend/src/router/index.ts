import { createNavigationGuard } from '@/app/navigationGuard.ts'
/**
 * 页面路由和访问前置检查。
 * 父路由负责选择布局，子路由负责具体页面；懒加载让页面模块在访问时才被请求。
 * meta 用于前端入口控制，接口的归属与管理员权限仍需服务端独立校验。
 */
import { createRouter, createWebHistory } from 'vue-router'

import { APP_BASE_URL } from '@/config/env.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

const router = createRouter({
  // History 模式使用全局 base；直接刷新子路由时托管服务需回退到前端入口页面。
  history: createWebHistory(APP_BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/BasicLayout.vue'),
      // 普通业务页面共享 BasicLayout，应用对话页由该布局内部切换为无导航工作区。
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/pages/HomePage.vue'),
        },
        {
          path: 'app/:id',
          // id 是后端应用标识，组件内保持字符串使用，不能为计算方便转成 Number。
          name: 'AppChatPage',
          component: () => import('@/pages/AppChatPage.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'admin/appManage',
          // 三个管理页面都声明 requiresAdmin，统一交给下面的全局守卫检查。
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
      // 登录、注册使用独立布局，避免业务导航干扰认证流程。
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

/**
 * 在进入页面前等待登录态探测完成，避免刷新页面时把“尚未加载用户”误判为“无权限”。
 * 返回路由对象会重定向；返回 true 才允许继续原来的跳转。
 */
router.beforeEach(createNavigationGuard(() => useLoginUserStore()))

export default router
