import * as generated from '@/api/userController.ts'
import {
  adaptResponse,
  entityId,
  successful,
  toWire,
  type RequestOptions,
} from '@/shared/api/adapter.ts'
import { mapPage, mapUser, mapSessionUser } from '@/shared/api/mappers.ts'
import type {
  UserCreate,
  UserLogin,
  UserQuery,
  UserRegister,
  UserUpdate,
} from '@/shared/domain/models.ts'

/** 集中封装登录、注册、用户资料和用户管理接口。 */
export class UserApiClient {
  /** 查询当前登录用户信息。 */
  getLogin = () => adaptResponse(generated.getLoginUser(), mapSessionUser)
  /** 提交用户登录凭据。 */
  login = (body: UserLogin) => adaptResponse(generated.login(body), mapSessionUser)
  /** 提交新用户注册信息。 */
  register = (body: UserRegister) => adaptResponse(generated.register(body), entityId)
  /** 提交退出登录请求。 */
  logout = () => adaptResponse(generated.logout(), successful)
  /** 创建应用或用户并返回接口结果。 */
  add = (body: UserCreate) => adaptResponse(generated.addUser(body), entityId)
  /** 更新相关状态或数据。 */
  update = (body: UserUpdate) =>
    adaptResponse(generated.updateUser(toWire<API.UserUpdateRequest>(body)), successful)
  /** 删除相关状态或数据。 */
  delete = (body: { id: string }) =>
    adaptResponse(generated.deleteUser(toWire<API.DeleteRequest>(body)), successful)
  /** 分页查询用户列表。 */
  listVo = (query: UserQuery, options?: RequestOptions) =>
    adaptResponse(generated.getUserVoList(toWire<API.UserQueryRequest>(query), options), (page) =>
      mapPage(page, mapUser),
    )
}

export type UserRepository = Pick<UserApiClient, keyof UserApiClient>
