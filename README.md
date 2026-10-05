# AI 零代码应用生成平台

一个基于 Spring Boot、LangChain4j 和 Vue 3 的 AI 代码生成平台。用户可以使用自然语言描述目标网站，后端调用兼容 OpenAI 接口的模型生成前端代码，并将结果保存为可直接运行的 HTML 文件或多文件网页项目。

当前仓库包含后端基础能力、用户管理模块和前端管理界面。AI 代码生成核心已经在后端服务层和测试中实现，前端的“算法”页面目前仍是功能入口占位页，尚未接入代码生成请求接口。

## 功能概览

- AI 生成单文件 HTML
  - 输出一个完整的 `index.html`。
  - 生成结果可直接使用浏览器打开。
  - 适合快速生成展示页、工具页和简单交互页面。
- AI 生成多文件网页
  - 输出 `index.html`、`style.css` 和 `script.js`。
  - 后端会严格解析模型返回的三个代码区块。
- 流式代码生成
  - 基于 Reactor `Flux<String>` 接收模型的增量输出。
  - 流式完成后自动解析并保存生成文件。
- 代码解析与落盘
  - 校验 HTML 是否以 `<!DOCTYPE html>` 开始并以 `</html>` 结束。
  - 生成文件保存到 `tmp/code_output` 下的唯一目录。
- 用户体系
  - 用户注册、登录、退出登录和当前用户查询。
  - 管理员用户管理、分页查询和角色校验。
  - 基于 Cookie/Session 的登录状态维护。
- 前端管理界面
  - Vue 3 + Vite + TypeScript。
  - Ant Design Vue 全局布局、导航、登录注册、个人信息和用户管理页面。
  - Pinia 管理当前登录用户状态。
- API 文档
  - 集成 Springdoc OpenAPI 和 Knife4j。

## 技术栈

### 后端

- Java 21
- Spring Boot 4.1.1
- Spring MVC
- MyBatis-Flex 1.11.8
- MySQL
- LangChain4j 1.21.0
- 兼容 OpenAI Chat Completions 的模型接口
- Reactor
- Hutool
- Lombok
- Knife4j OpenAPI 3

### 前端

- Vue 3
- TypeScript
- Vite
- Ant Design Vue
- Vue Router
- Pinia
- Axios
- ESLint、Oxlint、Prettier

## 项目结构

```text
ai-code-mother/
├── src/
│   ├── main/java/com/xy/aicodemother/
│   │   ├── ai/                 # LangChain4j AI 服务与返回模型
│   │   ├── common/             # 通用响应、分页和删除请求
│   │   ├── config/             # CORS、JSON 等配置
│   │   ├── controller/         # 健康检查和用户接口
│   │   ├── core/               # 代码生成门面、解析器和文件保存器
│   │   ├── exception/          # 异常、错误码和全局异常处理
│   │   ├── mapper/             # MyBatis-Flex Mapper
│   │   ├── model/              # 实体、DTO、VO 和枚举
│   │   └── service/            # 用户业务服务
│   ├── main/resources/
│   │   ├── mapper/             # MyBatis XML
│   │   ├── prompt/             # 单文件与多文件代码生成提示词
│   │   ├── application.yml     # 通用配置
│   │   └── application-local.yml # 本地配置，不提交到 Git
│   └── test/                   # 单元测试和 Spring Boot 测试
├── ai-code-mother-frontend/    # Vue 前端工程
├── sql/create_table.sql        # 数据库和用户表初始化脚本
├── tmp/code_output/            # AI 生成文件输出目录
├── pom.xml
└── mvnw / mvnw.cmd
```

## 环境要求

- JDK 21 或更高版本
- MySQL 8.x（建议）
- Maven 3.9+，或直接使用项目自带的 Maven Wrapper
- Node.js `22.18+` 或 `24.12+`
- npm
- 一个兼容 OpenAI API 的聊天模型服务，以及对应的 API Key

## 快速启动

### 1. 初始化数据库

创建数据库和用户表：

```bash
mysql -u root -p < sql/create_table.sql
```

如果 MySQL 账号、密码或端口不同，请修改 `src/main/resources/application.yml` 中的 `spring.datasource` 配置，或改为通过环境变量注入。

### 2. 配置模型服务

项目使用 `local` Profile。请创建或修改本地配置文件：

`src/main/resources/application-local.yml`

示例配置如下，API Key 请使用环境变量或本地密钥管理工具，不要提交真实密钥：

```yaml
langchain4j:
  open-ai:
    chat-model:
      api-key: ${AI_API_KEY}
      base-url: ${AI_BASE_URL:https://api.openai.com/v1}
      model-name: ${AI_MODEL:gpt-4o-mini}
      timeout: 600s
      max-retries: 1
      log-requests: false
      log-responses: false
    streaming-chat-model:
      api-key: ${langchain4j.open-ai.chat-model.api-key}
      base-url: ${langchain4j.open-ai.chat-model.base-url}
      model-name: ${langchain4j.open-ai.chat-model.model-name}
      timeout: ${langchain4j.open-ai.chat-model.timeout}
      log-requests: false
      log-responses: false
```

启动前设置环境变量：

```bash
export AI_API_KEY="你的模型 API Key"
export AI_BASE_URL="你的 OpenAI 兼容接口地址"
export AI_MODEL="你的模型名称"
```

`application-local.yml` 已加入 `.gitignore`，请不要将真实 API Key、数据库密码或其他敏感信息提交到仓库。

### 3. 启动后端

在项目根目录执行：

```bash
./mvnw spring-boot:run
```

Windows 环境执行：

```bat
mvnw.cmd spring-boot:run
```

后端默认地址：

```text
http://localhost:8123/api
```

健康检查接口：

```text
GET http://localhost:8123/api/health/
```

正常响应示例：

```json
{
  "code": 0,
  "data": "OK!",
  "message": "OK"
}
```

### 4. 启动前端

打开新的终端窗口：

```bash
cd ai-code-mother-frontend
npm install
npm run dev
```

前端默认由 Vite 提供开发服务，终端会输出实际访问地址。前端 Axios 当前请求后端：

```text
http://localhost:8123/api
```

如果后端地址发生变化，请同步修改 `ai-code-mother-frontend/src/request.ts`。

## 常用命令

### 后端

```bash
# 编译并运行测试
./mvnw test

# 打包
./mvnw clean package

# 只运行指定测试
./mvnw -Dtest=CodeParserTest test
```

AI 模型调用测试默认不会执行，需要显式开启：

```bash
RUN_LLM_TESTS=true ./mvnw test
```

开启前请确认模型服务配置正确，因为这类测试会产生真实模型调用和费用。

### 前端

在 `ai-code-mother-frontend` 目录执行：

```bash
# 开发模式
npm run dev

# 类型检查并构建生产版本
npm run build

# 代码检查和自动修复
npm run lint

# 生成或更新 OpenAPI TypeScript 类型
npm run openapi2ts

# 预览生产构建结果
npm run preview
```

运行 `npm run openapi2ts` 前，请先启动后端，确保以下 OpenAPI 地址可以访问：

```text
http://localhost:8123/api/v3/api-docs
```

## 后端核心流程

1. `AiCodeGeneratorService` 通过 LangChain4j 声明单文件、多文件和流式生成方法。
2. `AiCodeGeneratorServiceFactory` 注入普通聊天模型和流式聊天模型，创建 AI 服务代理。
3. `AiCodeGeneratorFacade` 根据 `CodeGenTypeEnum` 选择 HTML 模式或多文件模式。
4. `CodeParser` 解析并校验模型输出格式。
5. `CodeFileSaver` 将结果写入 `tmp/code_output/<类型>_<唯一 ID>/`。

支持的生成类型：

- `html`：原生 HTML 单文件模式。
- `multi_file`：`index.html`、`style.css`、`script.js` 多文件模式。

生成结果示例目录：

```text
tmp/code_output/
├── html_195xxxxxxxxxxxx/
│   └── index.html
└── multi_file_195xxxxxxxxxxxx/
    ├── index.html
    ├── style.css
    └── script.js
```

## 主要接口

所有后端接口都带有 `/api` Context Path。

### 健康检查

- `GET /health/`：返回服务健康状态。

### 用户接口

- `POST /user/register`：用户注册。
- `POST /user/login`：用户登录。
- `POST /user/logout`：退出登录。
- `POST /user/get/login`：获取当前登录用户。
- `POST /user/get/vo?id={id}`：获取脱敏用户信息。
- `POST /user/add`：管理员新增用户。
- `POST /user/delete`：管理员删除用户。
- `POST /user/get?id={id}`：管理员查询用户详情。
- `POST /user/update`：管理员更新用户。
- `POST /user/list/page/vo`：管理员分页查询用户。

统一响应结构为：

```json
{
  "code": 0,
  "data": {},
  "message": "OK"
}
```

常见错误码：

- `40000`：请求参数错误。
- `40100`：未登录。
- `40101`：无权限。
- `40400`：数据不存在。
- `50000`：系统内部异常。
- `50001`：操作失败。

## 前端页面

- `/`：首页。
- `/algorithm`：算法/代码生成入口，目前为占位页。
- `/user/login`：登录页。
- `/user/register`：注册页。
- `/user/profile`：个人信息页。
- `/admin/userManage`：管理员用户管理页，仅管理员角色可访问。

## API 文档

启动后端后，可根据 Knife4j 默认配置尝试访问：

```text
http://localhost:8123/api/doc.html
```

原始 OpenAPI JSON 地址：

```text
http://localhost:8123/api/v3/api-docs
```

## 当前限制与后续方向

- 当前没有公开的 AI 代码生成 Controller，AI 生成能力主要通过 `AiCodeGeneratorFacade` 提供给后端代码和测试使用。
- 前端“算法”页面尚未调用 AI 生成服务，也没有展示生成文件的在线预览和下载流程。
- 当前生成文件保存到本地 `tmp/code_output`，未接入对象存储、任务记录或历史项目管理。
- CORS 当前允许任意来源，生产环境应根据部署域名收紧允许来源。
- 生产环境应将数据库配置、模型 API Key、日志级别和超时时间放入安全的配置中心或环境变量中。

## 开发建议

- 修改代码生成格式时，同时更新对应的提示词、`CodeParser` 和 `CodeParserTest`。
- 新增后端接口后，重新运行 `npm run openapi2ts` 更新前端 API 类型。
- 提交代码前执行：

```bash
./mvnw test
cd ai-code-mother-frontend
npm run build
npm run lint
```

## 许可证

当前仓库未声明开源许可证。如需对外发布，请根据项目实际授权方式补充 LICENSE 文件。
