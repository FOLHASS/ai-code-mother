# AI Code Mother 前端

Vue 3 + TypeScript + Vite，提供应用生成、聊天、预览编辑、应用管理和用户管理。生成请求使用原生 fetch 读取 SSE，其余业务请求通过 Axios 和生成 API 适配层访问后端。

## 本地运行

使用 Node `^22.18.0 || >=24.12.0`，推荐 Node 24；使用仓库内的 package-lock.json：

```sh
npm ci
npm run dev
```

后端默认位于 `http://localhost:8123`。预览网关作为 Vite 开发插件随主站一起启动、重启和关闭，默认预览端口 `5174`；主站建议通过 `http://localhost:5173` 访问。`npm run dev`、直接运行 `vite` 和 IDE 启动 Vite 都会启动网关，避免主站可用但生成后的网站无法展示。端口占用时启动会明确报错；Vite 自动切换主站端口时，网关同步允许实际使用的端口。

配置入口为 `src/config/env.ts`，环境变量变更后需要重新启动/构建。开发默认配置：

- `VITE_API_BASE_URL=/api`：主站的认证 API；开发时代理到后端。
- `PREVIEW_UPSTREAM=http://localhost:8123`：Node 预览网关访问的私有后端；原始 Vite API 代理仍指向 localhost:8123。
- `PREVIEW_PORT=5174`：本地静态预览代理端口；例如 `PREVIEW_PORT=5175 npm run dev`，主站会自动使用该端口。
- `VITE_PREVIEW_BASE_URL=http://127.0.0.1:5174`：可选的独立预览 origin，只填写协议、主机和端口，不包含 `/static` 或 `/api/static`。默认不显式配置，开发环境根据主站在 localhost/127.0.0.1 间选择另一主机名。
- `VITE_DEPLOY_DOMAIN`：已发布作品所在 origin。部署接口返回的完整 URL 仍优先用于刚发布的作品；未配置时不构造可能错误的 deployKey 链接。

### 对应当前本机后端与 Nginx

生成预览和部署使用不同目录及标识：

- HTML、多文件预览：`http://127.0.0.1:5174/api/static/<codeGenType>_<appId>/`，网关读取后端 `8123` 提供的 `tmp/code_output` 文件。
- Vue 预览：优先读取后端已发布的 `tmp/code_preview/vue_project_<appId>/`；根入口返回 404 时使用 `tmp/code_output/vue_project_<appId>/dist/index.html`。不要加载源码入口 `index.html`。
- 点击部署后：后端将静态文件复制到 `tmp/code_deploy/<deployKey>/`，当前 Nginx 的 `80` / `8080` 端口提供 `http://localhost/<deployKey>/`。`.env.development` 的 `VITE_DEPLOY_DOMAIN=http://localhost` 与此匹配。

不要把 `VITE_PREVIEW_BASE_URL` 设置为 Nginx 的 `http://localhost`：该站点只托管部署目录，没有 `/api/static` 预览接口。生成网站尚未部署时也应能预览，无需先点击部署。Nginx 的部署配置不需要承担 `5174` 预览网关的职责。

## 检查与构建

```sh
npm run type-check
npm run lint:check
npm test
npm run build
```

`npm run check` 按顺序运行类型、Lint、架构、行为测试、主站构建和独立预览脚本构建。行为测试使用替代依赖，不调用真实模型。

`npm run lint:fix` 与 `npm run format` 是显式修改源码的命令；默认 Lint 为只读。ESLint、Oxlint、Prettier 都排除 `src/api`。

`npm run build` 保持普通 Vite 主站构建。部署独立预览网关前，另外执行 `npm run build:preview`，生成 `dist/preview-editor-bridge.js`，该步骤不依赖额外 Vite 配置。开发网关直接从源码编译编辑脚本，不需要预先构建。`scripts/check-bundle.mjs` 依赖 manifest，不接入当前标准构建。

测试运行器基于 node:test，通过同步 module hooks 使用本地 TypeScript 编译和解析 `@/`。

## 架构边界

```text
src/app/                      Vue 生命周期、路由相关装配与 UI 适配
src/features/
  app-workbench/              会话编排、列表滚动、对话页组合 UI
  ai-chat/                    消息时间线、生成流、历史分页、Markdown UI
  preview-editor/             跨源父桥、iframe runtime、预览就绪检测
  app-management/             应用查询/动作、权限策略、应用业务 UI
  user-management/            登录、资料、管理员用户维护
  home/                       首页列表与创建/编辑/删除场景
src/shared/                   领域值、端口、传输适配、异步和通用工具
src/stores/                   Pinia 会话适配
src/pages/                    路由页面装配
src/components/               通用展示组件
src/layouts/                  页面壳与全局导航
src/api/                      受保护的生成代码
scripts/                      架构检查、包体积检查与隔离预览网关
```

feature 之间只通过根 `index.ts` 或公开的 `api/index.ts`、`components/index.ts` 访问。内部模块使用相对路径。Service/Controller 构造函数不读取 Router、Pinia，也不注册 Vue 生命周期；依赖由 app 装配，挂载/卸载通过 `useController` 连接 `start/dispose`。

Controller 通过命令修改自己的状态，对外暴露只读数据；表单草稿和聊天输入仍允许受控编辑。生成服务不处理 DOM 或 UI 提示，预览检查不阻塞生成完成，滚动锚点由工作台持有。普通列表通过取消与版本检查保证旧响应无法覆盖新状态。

会话状态区分 unknown/loading/authenticated/anonymous/error，共享进行中的初始化；显式登录或退出会让旧探测失效。Axios、SSE、归档下载共享认证失效事件。前端能力控制始终需要后端独立鉴权。

## ID 与生成 API 保护

ID 在页面、路由、领域类型和请求中均为字符串。响应适配拒绝超出安全整数范围的数字 ID，避免把已经舍入的数字误当作有效标识；服务端需按既有约定把 Long 序列化成字符串。

后端把分页 Long 字段序列化为字符串时，适配层将 totalRow、pageNumber、pageSize、totalPage 归一为安全非负整数。记录 ID 继续保持字符串，分页组件与首次提示词判断使用数值。

`src/api` 保持原样。生成类型的 number 声明仅在 `src/shared/api/adapter.ts` 与 feature API 适配器中兼容，不进行 Number/parseInt 转换。业务层不再直接引用 API 命名空间。

`scripts/generated-api.sha256.json` 记录本次重构前的 6 个生成文件；架构检查会校验文件集合与逐文件 SHA-256。后续若明确决定升级协议并重新生成，需要另开变更同时审核生成文件和保护清单。本次重构未运行生成器。现有生成器配置仍指向本地后端的 `/api/v3/api-docs`。

## 隔离预览部署

生产主站应通过下述 Nginx 配置禁止直接提供 `/api/static` 生成内容。独立网关只允许 GET/HEAD/OPTIONS 的静态路径，拒绝认证/写接口和上游重定向，不转发 Cookie、Authorization 或 Set-Cookie，向 HTML 注入独立编辑脚本。父页面不再访问 iframe DOM，通过校验窗口、origin、随机 channel 和有界数据的 postMessage 协议交互。

Vue 项目优先读取 `/api/static/vue_project_<id>/` 下已发布的预览；404 时兼容旧的 `/dist/index.html`。就绪检测返回的实际地址用于 iframe，保留刷新时间戳。

生产构建应设置真实地址，例如：

```sh
VITE_API_BASE_URL=/api \
VITE_PREVIEW_BASE_URL=https://preview.exampleusercontent.net \
VITE_DEPLOY_DOMAIN=https://published.exampleusercontent.net \
npm run build
npm run build:preview
```

这些域名是示例，替换成实际部署地址。没有配置预览 origin 时，生产界面显示预览不可用，不回退到同源执行生成代码。

在预览节点运行：

```sh
PREVIEW_APP_ORIGIN=https://app.example.com \
PREVIEW_UPSTREAM=http://backend:8123 \
PREVIEW_PORT=5174 \
node scripts/preview-server.ts
```

参考 `deploy/nginx.conf.example` 将主站 API 和预览网关分开代理，并配置自己的 TLS、域名与服务进程管理。后台 8123 端口保持私有，避免绕开网关直接访问生成 HTML。

预览站点应使用独立的凭据范围，建议不同的可注册域；业务 Cookie 保持 host-only，服务端保留 SameSite/CSRF/Origin 校验。前端构建不能替代这些部署与服务端约束。本仓库未变更后端、Cookie 配置或线上部署。

SSE 仍兼容现有 GET 接口，对编码后的 query 设置上限，并设置 90 秒空闲超时；不会自动重试可能产生写入或计费的生成请求。改用 POST 流或任务订阅需要服务端另行支持，本次没有改变现有接口协议。

## CI

仓库根的 `.github/workflows/frontend.yml` 针对前端目录运行 Node 22.18 / 24.12 两套检查，使用 `npm ci`、类型检查、只读 Lint、测试和构建。前端的 `ci/frontend.yml` 保留同一配置作为可审阅模板。

## 回归重点

当前回归覆盖：分页字符串归一与大 ID 保留、无效分页数据拒绝、字符串零历史触发首条提示词、已有历史与后续消息展示、生成错误保留用户消息、Vue 发布目录与旧 dist 兼容、独立预览编辑脚本编译。浏览器回归使用本机模拟后端检查创建、消息、预览和刷新，避免调用真实模型。

部署前还需用真实后端检查生成、静态文件布局、发布域名、下载 Content-Type、跨站 Cookie 和 CSP。这些联调依赖实际部署环境。
