import { ApiError } from '@/shared/api/errors.ts'
import { authEvents } from '@/shared/api/authEvents.ts'
import * as generated from '@/api/appController.ts'
import {
  adaptResponse,
  entityId,
  successful,
  toWire,
  type RequestOptions,
} from '@/shared/api/adapter.ts'
import { mapApp, mapPage } from '@/shared/api/mappers.ts'
import type { AppCreate, AppQuery, AppUpdate } from '@/shared/domain/models.ts'

/** 集中封装应用创建、查询、更新、部署和下载接口。 */
export class AppApiClient {
  /** 创建应用或用户并返回接口结果。 */
  add = (body: AppCreate) => adaptResponse(generated.addApp(body), entityId)
  /** 读取vo by id相关状态或数据。 */
  getVoById = (params: { id: string }, options?: RequestOptions) =>
    adaptResponse(generated.getAppVoById(toWire<API.getAppVOByIdParams>(params), options), mapApp)
  /** 按 ID 查询管理端应用详情。 */
  adminGetVoById = (params: { id: string }, options?: RequestOptions) =>
    adaptResponse(
      generated.adminGetAppVoById(toWire<API.adminGetAppVOByIdParams>(params), options),
      mapApp,
    )
  /** 分页查询当前用户的应用列表。 */
  listMyVoByPage = (query: AppQuery, options?: RequestOptions) =>
    adaptResponse(
      generated.listMyAppVoByPage(toWire<API.AppQueryRequest>(query), options),
      (page) => mapPage(page, mapApp),
    )
  /** 分页查询首页精选应用列表。 */
  listGoodVoByPage = (query: AppQuery, options?: RequestOptions) =>
    adaptResponse(
      generated.listGoodAppVoByPage(toWire<API.AppQueryRequest>(query), options),
      (page) => mapPage(page, mapApp),
    )
  /** 分页查询管理端应用列表。 */
  adminListVoByPage = (query: AppQuery, options?: RequestOptions) =>
    adaptResponse(
      generated.adminListAppVoByPage(toWire<API.AppQueryRequest>(query), options),
      (page) => mapPage(page, mapApp),
    )
  /** 更新应用名称，支持弹窗关闭时取消仍在等待的请求。 */
  update = (body: AppUpdate, options?: RequestOptions) =>
    adaptResponse(generated.updateApp(toWire<API.AppUpdateRequest>(body), options), successful)
  /** 更新管理端应用信息。 */
  adminUpdate = (body: AppUpdate, options?: RequestOptions) =>
    adaptResponse(
      generated.adminUpdateApp(toWire<API.AppAdminUpdateRequest>(body), options),
      successful,
    )
  /** 删除相关状态或数据。 */
  delete = (body: { id: string }) =>
    adaptResponse(generated.deleteApp(toWire<API.DeleteRequest>(body)), successful)
  /** 删除管理端应用。 */
  adminDelete = (body: { id: string }) =>
    adaptResponse(generated.adminDeleteApp(toWire<API.DeleteRequest>(body)), successful)
  /** 部署当前应用代码并保存部署结果。 */
  deploy = (params: { appId: string }) =>
    adaptResponse(generated.deploy(toWire<API.deployParams>(params)), (url) => url)
  /** 下载应用源代码归档。 */
  downloadCode = async (params: { appId: string }, options?: RequestOptions) => {
    const response = await generated.downloadAppCode(toWire<API.downloadAppCodeParams>(params), {
      ...options,
      responseType: 'blob',
    })
    if (
      response.data instanceof Blob &&
      String(response.headers['content-type']).includes('application/json')
    ) {
      const result = JSON.parse(await response.data.text()) as { code?: number; message?: string }
      if (result.code === 40100) authEvents.expired()
      throw new ApiError(result.message || '下载代码失败', result.code)
    }
    return response
  }
}

export type AppRepository = Pick<AppApiClient, keyof AppApiClient>
