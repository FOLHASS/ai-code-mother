import type { AxiosResponse } from 'axios'
import { ApiError } from './errors.ts'

/**
 * 后端所有的接口返回的数据类戏ing
 */
export type BaseResponse<T> = { code?: number; data?: T; message?: string }
/**
 * axios 调用接口后得到数据结果， 能正确返回结构code一定为0
 */
export type ApiResult<T> = { data: { code: 0; data: T; message?: string } }

/**
 * signal： 实现请求终止，比如切换页面、等待AI回复响，未完成响应等接口 实现终止。
 */
export type RequestOptions = { signal?: AbortSignal; responseType?: 'blob' }

/** 将生成接口中的数字 ID 兼容处理集中在传输适配边界。 */
export function toWire<T>(value: unknown): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const request: Record<string, unknown> = { ...value }
    for (const key of ['id', 'appId', 'userId', 'lastId']) {
      if (request[key] !== undefined) request[key] = entityId(request[key])
    }
    return request as T
  }
  return value as T
}

/** 将实体 ID 规范化为字符串。 */
export function entityId(value: unknown): string {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new ApiError('服务端返回了超出安全范围的数字 ID，请使用字符串序列化')
  }
  const id = typeof value === 'string' ? value.trim() : String(value ?? '')
  if (!/^[1-9]\d*$/.test(id)) throw new ApiError('无效的记录 ID')
  return id
}

/** 将可选 ID 规范化为字符串或空值。 */
export function optionalId(value: unknown): string | undefined {
  return value == null ? undefined : entityId(value)
}

/**
 * 把接口响应适配为统一的业务结果
 * @param request
 * @param map 实现将返回格式转化成需要的格式
 */
export async function adaptResponse<T, U>(
  request: Promise<AxiosResponse<BaseResponse<T>>>,
  map: (data: T) => U,
): Promise<ApiResult<U>> {
  const response = await request
  const { code, data, message } = response.data
  if (code !== 0) throw new ApiError(message || '请求失败，请稍后重试', code)
  if (data == null) throw new ApiError(message || '服务端返回的数据不完整')
  return { data: { code: 0, data: map(data), message } }
}

/** 判断接口响应是否表示业务成功。 */
export function successful(value: boolean): boolean {
  if (!value) throw new ApiError('操作未完成，请刷新后重试')
  return true
}
