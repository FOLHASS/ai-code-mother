import axios from 'axios'
import { API_BASE_URL } from '@/config/env.ts'
import { ApiError } from '@/shared/api/errors.ts'
import { authEvents } from '@/shared/api/authEvents.ts'

const request = axios.create({ baseURL: API_BASE_URL, timeout: 60000, withCredentials: true })

/** 判断当前接口错误是否需要向用户显示通知。 */
function shouldNotify(url = '') {
  return !/\/user\/(?:get\/login|login|register)(?:[/?]|$)/.test(url)
}

request.interceptors.response.use(
  (response) => {
    const body: unknown = response.data
    if (
      body &&
      typeof body === 'object' &&
      'code' in body &&
      typeof body.code === 'number' &&
      body.code !== 0
    ) {
      if (body.code === 40100 && shouldNotify(response.config.url)) authEvents.expired()
      throw new ApiError(
        'message' in body && typeof body.message === 'string' ? body.message : '请求失败',
        body.code,
      )
    }
    return response
  },
  (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error)
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 && shouldNotify(error.config?.url)) authEvents.expired()
      return Promise.reject(
        new ApiError(
          error.response?.status === 401 ? '登录已过期，请重新登录' : '网络请求失败，请稍后重试',
          undefined,
          error.response?.status,
        ),
      )
    }
    return Promise.reject(error)
  },
)

export default request
