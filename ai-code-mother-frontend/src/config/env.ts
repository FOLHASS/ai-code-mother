/**
 * 浏览器代码读取环境配置的唯一入口，同时统一构造部署与预览地址。
 * import.meta.env 由 Vite 按运行模式加载并在构建时替换；修改环境配置后需要重新启动或构建。
 * 部署域名对应已发布作品，API/static 对应生成中的预览，两条访问路径具有不同用途。
 * 环境变量配置
 */
import { CodeGenTypeEnum } from '@/utils/codeGenTypes.ts'

// 应用部署域名
// 未设置时沿用本地作品发布服务地址，不包含具体的 deployKey。
export const DEPLOY_DOMAIN = import.meta.env.VITE_DEPLOY_DOMAIN || 'http://localhost'

// API 基础地址
// 开发环境可以使用 /api 交给 Vite 代理，也可以配置包含 /api 的完整后端地址。
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8123/api'

// 前端路由基础路径（由 Vite 的 base 配置决定）
// 与应用的托管子路径保持一致，供 createWebHistory 解析和生成路由 URL。
export const APP_BASE_URL = import.meta.env.BASE_URL

// 静态资源地址
// 先去掉 API 地址末尾的斜杠，避免拼接出 //static 这样的重复路径分隔符。
export const STATIC_BASE_URL = `${API_BASE_URL.replace(/\/+$/, '')}/static`

// 获取部署应用的完整URL
/** deployKey 作为单个路径片段编码；是否存在有效部署标识由上层业务判断。 */
export const getDeployUrl = (deployKey: string) => {
  return `${DEPLOY_DOMAIN.replace(/\/+$/, '')}/${encodeURIComponent(deployKey)}`
}

// 获取静态资源预览URL
/**
 * @param codeGenType 后端返回的生成类型；只在需要 Vue 构建产物时使用统一枚举判断。
 * @param appId 保持字符串形式的应用 ID，避免 Java Long 在 JavaScript 中发生精度损失。
 * @returns 生成目录中的页面入口地址，不等同于已部署作品的访问地址。
 */
export const getStaticPreviewUrl = (codeGenType: string, appId: string) => {
  const baseUrl = `${STATIC_BASE_URL}/${codeGenType}_${appId}/`
  // 如果是 Vue 项目，浏览地址需要添加 dist 后缀
  if (codeGenType === CodeGenTypeEnum.VUE_PROJECT) {
    // Vue 工程源码不能直接在浏览器运行，这里加载构建后的 dist/index.html。
    return `${baseUrl}dist/index.html`
  }
  // HTML 和原生多文件模式直接使用生成目录，由静态资源接口处理默认入口。
  return baseUrl
}
