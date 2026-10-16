/**
 * openapi2ts 生成器配置：从后端 OpenAPI 文档生成请求方法和类型声明。
 * 这是生成代码所用的工具配置，不会在页面运行时调用；生成流程与页面请求流程互相独立。
 * src/api 是自动生成目录，业务扩展应通过外部包装层实现，避免再次生成时覆盖手工修改。
 */
export default {
  // 让生成的请求方法复用统一 Axios 实例与响应处理，而不是自行创建第二套请求客户端。
  requestLibPath: "import request from '@/request'",
  // 指向本地后端公开的接口协议文档，生成时需要后端服务能提供这个地址。
  schemaPath: 'http://localhost:8123/api/v3/api-docs',
  // 生成文件的源码根目录，工具据此在 src 下组织 API 模块。
  serversPath: './src',
}
