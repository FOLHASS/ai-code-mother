/**
 * 普通 HTTP 请求的统一入口，供自动生成的 API 模块复用。
 * API 模块继续返回完整 AxiosResponse，业务页面自行判断 data.code/data.data。
 * SSE 生成接口使用 chatStream.ts 的原生 fetch，不经过此实例的响应拦截器。
 */
import axios from 'axios'
import { message } from 'ant-design-vue'

import { API_BASE_URL } from '@/config/env.ts'

// 创建 Axios 实例
const myAxios = axios.create({
  // 与静态预览、流式请求共用配置，避免不同调用链连接到不同后端。
  baseURL: API_BASE_URL,
  // Axios 的普通接口请求等待上限，单位为毫秒。
  timeout: 60000,
  // 携带浏览器会话凭证，让后端通过 Session 识别当前登录用户。
  withCredentials: true,
})

// 全局请求拦截器
myAxios.interceptors.request.use(
  // 当前不额外改写请求参数，保留统一拦截扩展点。
  function (config) {
    // Do something before request is sent
    return config
  },
  // 请求尚未成功发出时也将错误继续交给调用方，便于页面恢复 loading 等状态。
  function (error) {
    // Do something with request error
    return Promise.reject(error)
  },
)

// 全局响应拦截器
myAxios.interceptors.response.use(
  function (response) {
    const { data } = response
    // 未登录
    if (data.code === 40100) {
      // 登录态探测本身可能正常返回未登录；排除它和登录页面以避免跳转循环。
      // 不是获取用户信息的请求，并且用户目前不是已经在用户登录页面，则跳转到登录页面
      if (
        !response.request.responseURL.includes('user/get/login') &&
        !window.location.pathname.includes('/user/login')
      ) {
        message.warning('请先登录')
        // 保留当前位置供登录后返回；encodeURIComponent 避免原 URL 的参数破坏 redirect。
        window.location.href = `/user/login?redirect=${encodeURIComponent(window.location.href)}`
      }
    }
    // 包括业务错误响应在内都维持原结构，由业务调用处负责具体错误提示。
    return response
  },
  // HTTP 失败不伪造业务成功结果，调用方仍能在 catch/finally 中处理异常。
  function (error) {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    // Do something with response error
    return Promise.reject(error)
  },
)

export default myAxios
