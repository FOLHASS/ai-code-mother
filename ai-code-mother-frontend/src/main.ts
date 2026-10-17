/**
 * 浏览器入口：创建 Vue 应用、安装共享状态/路由/UI 插件，并挂载到 index.html 的 #app。
 * 这里只做基础设施装配；具体页面的数据请求与交互放在页面或组合式函数中。
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { installSessionExpiry } from '@/app/sessionExpiry.ts'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'
// 重置 Ant Design Vue 的基础样式，让原生元素与组件库有一致的默认视觉基础。
import 'ant-design-vue/dist/reset.css'
import '@/shared/styles/tokens.css'

// 一个页面加载周期只创建一个根实例，App.vue 负责承接当前路由对应的组件。
const app = createApp(App)

// 登录状态在路由守卫和多个页面间共享，统一由当前 Pinia 实例提供。
const pinia = createPinia()

// 先安装 Pinia，再安装会读取用户 Store 的路由；UI 组件由各 SFC 按需导入。
app.use(pinia)
installSessionExpiry(router, useLoginUserStore(pinia))
app.use(router)

// 此时才开始渲染组件树，因此上面安装的插件在所有子组件中都已可用。
app.mount('#app')
