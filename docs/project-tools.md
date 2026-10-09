# 工程工具使用说明

Vue 工程模式已注册 10 个 LangChain4j 工具，支持目录读取、定向修改、构建和静态预览。
`appId` 由 AI 接口的 `@MemoryId` 传给工具的 `@ToolMemoryId`，不开放给模型填写。
应用生成接口仍由 `AppService` 校验当前用户是应用创建者；工具没有新增公开 HTTP 写文件接口。

## 文件工具

- `list_files(directory)`：递归列出允许访问的工程文件与目录，根目录传 `.`。排除依赖、构建目录、隐藏文件、凭证和符号链接。结果过多时返回 `truncated`，可以改查子目录。
- `read_file(path)`：读取 UTF-8 源码，返回 `data.path`、`data.content`、`data.sha256`、`data.sizeBytes`。
- `search_files(query)`：区分大小写的单行字面量搜索，返回文件、从 1 开始的行号和有限上下文，不执行正则表达式。二进制资源不参与搜索。
- `create_file(path, content)`：创建源码及父目录，文件存在时拒绝覆盖。
- `update_file(path, expectedSha256, content)`：核对当前文件哈希后，用完整新内容原子更新。版本变化时必须重新读取。
- `apply_patch(path, expectedSha256, oldText, newText)`：核对哈希后精确替换一个唯一文本片段。`oldText` 必须非空且恰好出现一次；`newText` 可以为空。不接受 unified diff。
- `delete_file(path, expectedSha256)`：校验哈希后删除一个源码文件，禁止递归删除目录。

文件工具返回 `success/message/data`。发生冲突时，不要沿用旧哈希重试，应重新 `read_file` 并结合最新内容修改。
图片和字体等已有静态资源可以出现在目录及构建快照中，但文本工具不会读取、搜索或编辑二进制内容。
默认单文件上限 1 MiB、目录结果最多 1000 条、搜索结果最多 100 条，均可通过服务端配置调整。

## 检查、构建和发布

1. `type_check()`：在独立源码快照中执行现有 `type-check` 或 `typecheck` 脚本。没有脚本时返回 `CONFIGURATION_ERROR`，不会假装检查通过。
2. `build_project()`：复制源码快照、安装依赖、运行 `npm run build -- --base=./`，校验 `dist/index.html`，返回成功状态、`buildId`、源码指纹和有界日志。
3. `publish_preview(buildId)`：只发布当前应用对应的成功构建；源码发生变化后必须重新构建。发布失败保留上一版预览。

有 `package-lock.json` 时安装使用 `npm ci`，否则使用 `npm install`；均禁用生命周期脚本并关闭审计、筹款输出。
构建失败、超时或执行环境缺失会返回明确状态，不会发布失败产物。
模型输出结束时，Facade 会再次确保当前源码已经构建、发布，然后才让生成流完成。
Vue 工程不会再把 AI 回复当作 HTML/CSS/JS 三个代码块解析。

## 运行环境与配置

默认使用 Docker 构建，服务器需安装并启动 Docker，提前准备 `node:22-bookworm-slim` 镜像。
执行器不会自动下载镜像。容器只挂载本次构建快照，限制 CPU、内存和进程数量，不挂载后端目录、密钥或 Docker socket。
安装依赖需要容器能够访问 npm registry；生产部署应按需要限制网络出口。

可在独立的环境配置中覆盖下列参数：

```yaml
project:
  tools:
    execution-mode: docker
    docker-image: node:22-bookworm-slim
    command-timeout-seconds: 120
    max-concurrent-builds: 2
    install-dependencies: true
    preview-base-url: http://localhost:8123/api/static
    max-file-bytes: 1048576
    max-list-entries: 1000
    max-search-results: 100
```

可信本地开发可显式设置 `execution-mode: local` 和 `npm-executable`（默认 `npm`）。
local 模式仍使用源码快照、固定命令、日志上限和超时，但不能代替容器隔离；不要用于运行不可信用户工程。
如果禁用依赖安装，需要执行环境自行提供可用依赖，此配置通常用于测试或自定义执行器。

## 目录和地址

默认源码目录为 `tmp/code_output/vue_project_{appId}`，私有构建目录为 `tmp/project_build`，发布产物在 `tmp/code_preview/vue_project_{appId}`。
三个目录必须相互独立，可通过 `workspace-root`、`build-root`、`preview-root` 覆盖。

生成预览继续使用 `http://localhost:8123/api/static/vue_project_{appId}/`，该地址只提供发布后的静态产物。
部署接口复制发布后的 dist，部署地址仍为 `http://localhost/{deployKey}`，与生成预览地址分别使用。
删除 Vue 应用在数据库提交后清理源码、构建和预览，并阻止旧生成任务继续使用文件工具；资源清理失败会记录日志，需由运维重试清理。

同一应用的文件操作、构建和发布在当前 JVM 内共用锁；部署多个后端实例时需增加分布式锁和持久化构建状态。
成功构建索引保存在内存，服务重启后重新调用构建或发布流程即可恢复；已发布的静态预览文件仍然保留。
构建容器隔离不等于浏览器隔离，生产环境应使用独立的预览域名和适当的 iframe 策略。

## 验证

文件工具、源码指纹、版本冲突、并发更新、符号链接、构建失败保留预览、超时进程清理和工具参数注入均有独立测试。
测试使用临时目录、假命令执行器及模拟 AI 流，不调用真实模型、数据库或 Redis，也不安装 npm 依赖。
