<script setup lang="ts">
/**
 * 根组件只负责发起登录态初始化和承接 RouterView，不直接组织业务页面布局。
 * 普通页面与登录/注册页面使用哪种布局，由 router 中的父子路由关系决定。
 */
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

const loginUserStore = useLoginUserStore()
// 主动恢复登录态；void 表示这里不阻塞首屏，受保护路由另行等待初始化结果。
void loginUserStore.fetchLoginUser()
</script>

<template>
  <RouterView />
</template>
