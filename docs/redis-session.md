# Redis 分布式 Session 配置与验证

适用范围：本项目 Spring Boot 4.1.1、Servlet/Web MVC、Redis 和基于 `HttpSession` 的用户登录。目标是在**只重启后端服务、Redis 仍运行且浏览器保留 Cookie**时继续识别登录用户，并让多个后端实例共享同一登录态。

> 本文是配置说明，不直接修改项目代码或配置。下文 YAML 只展示相关字段，应合并到现有文件中，勿覆盖 MySQL、AI 服务等其他配置。

## 1. 当前项目状态

| 项目 | 当前实现 | 作用或待确认点 |
| --- | --- | --- |
| Session 依赖 | `pom.xml` 已引入 `org.springframework.boot:spring-boot-starter-session-data-redis`；旧的 `spring-session-data-redis` 依赖已注释 | **正确的 Boot 4.1 自动配置入口**；无需额外声明 `@EnableRedisHttpSession` |
| Redis 连接 | `application.yml`：`spring.data.redis.host=localhost`、`port=6379`，未填写密码 | 按 Redis 实际地址、端口和认证方式配置；本机当前有 Redis 进程监听 6379，但监听不等于已验证认证或应用连接 |
| 键名前缀 | `spring.session.data.redis.namespace=ai-code-mother:session` | Boot 4.1.1 的正确属性路径；用于隔离本应用 Session 键，**它本身不启用 Session** |
| Session 过期 | 尚未显式设置 `spring.session.timeout` 或 `server.servlet.session.timeout` | 默认是 **30 分钟不活动过期**；想维持更久需单独配置 |
| Cookie 过期 | `server.servlet.session.cookie.max-age=259200` | 浏览器 Cookie 最长保留 **3 天**；不等于 Redis Session 存活 3 天 |
| AI 记忆 TTL | `spring.data.redis.ttl=3600`，由 `RedisChatMemoryStoreConfig` 绑定并传给 LangChain4j | **只控制 AI 对话记忆**，不是 Spring Session 的过期时间；它是项目自定义字段 |
| 登录实现 | `UserServiceImpl.userLogin` 写入 `request.getSession().setAttribute("user_login", user)`；后续通过相同键读取 | Session starter 生效后仍沿用此逻辑，无需改登录接口 |
| 序列化 | `User` 实现了 `Serializable` | 当前登录对象可以按 Spring Session 默认 Java 序列化方式保存；见文末注意事项 |
| 前端 Cookie | `request.ts` 已配置 Axios `withCredentials: true`，后端 CORS 允许凭据 | 本地端口不同仍能携带 Cookie；浏览器访问前后端应统一使用 `localhost`，不要混用 `127.0.0.1` |

## 2. Maven 依赖

当前 `pom.xml` 已包含所需依赖：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-session-data-redis</artifactId>
</dependency>
```

Spring Boot parent 版本是 `4.1.1`，该 starter 无须另写版本号。它负责引入 Redis Session 所需组件及 Boot 自动配置。不要同时为相同用途手工添加旧版本的 Spring Session、Spring Data Redis 或 `@EnableRedisHttpSession` 配置，以免出现版本冲突或让自动配置退让。保留项目里的 LangChain4j Redis 组件没有问题：它是另一套用途，不能替代 Spring Session。

**此前只引入 `org.springframework.session:spring-session-data-redis` 时，缺少本项目所需的 Boot 4 自动配置入口；目前 `pom.xml` 已改好。**

## 3. 推荐的 YAML（按现有 3 天 Cookie 意图）

把以下相关字段**合并**到 `src/main/resources/application.yml`；当前文件已有的 `namespace`、Redis 地址、Cookie `max-age` 可以保留，只需按需补充 `spring.session.timeout`。这里用带单位的 `3d` 表达 3 天：

```yaml
spring:
  session:
    timeout: 3d              # Redis Session 不活动超时；按需求可改为 12h、1d 等
    data:
      redis:
        namespace: ai-code-mother:session
  data:
    redis:
      host: localhost
      port: 6379
      # Redis 启用了认证时才增加；不要把真实密码写入仓库：
      # password: ${REDIS_PASSWORD}
      ttl: 3600              # 当前仅供 RedisChatMemoryStoreConfig 使用，非 Session TTL

server:
  servlet:
    context-path: /api
    session:
      cookie:
        max-age: 3d          # 浏览器 Cookie 有效期；现有 259200 秒也是 3 天
```

`spring.session.timeout` 是服务端 Session 的**不活动超时**，不是绝对有效期。若未设置，Servlet 应用会回退到 `server.servlet.session.timeout`，当前项目未设置后者时默认 `30m`。Cookie 仍在、Redis Session 已过期时也会被视为未登录；只设置 `cookie.max-age` 不会延长 Session。Boot 4.1.1 内嵌 Servlet 环境的默认 Spring Session `CookieSerializer` 会读取该 Cookie 属性；如果日后自定义了 `CookieSerializer`，应以响应头中 `Set-Cookie: SESSION=...; Max-Age=...` 的实际结果为准。若只要求短时间重启后保留登录，可以设置较短的 Session 超时，不必一定使用 3 天。

Boot **4.1.1** 的 Redis Session 属性是 `spring.session.data.redis.namespace`。部分针对其他 Boot 版本的教程写作 `spring.session.redis.namespace`，不要照搬后覆盖本项目的正确路径。`spring.data.redis.password` 只在 Redis 服务确实要求认证时配置；生产环境使用环境变量或受控配置，不提交明文。

## 4. 启动与逐步验收

1. **确认依赖已重新加载。** Maven/IDE 重新导入 `pom.xml`；启动前确保 MySQL、Redis 和项目所需的其他环境配置齐全。如果启动报 Redis 连接或认证异常，先核对 `spring.data.redis` 地址和密码。
2. **确认 Redis 可用。** 本机无密码时可执行 `redis-cli -h 127.0.0.1 -p 6379 PING`，期望 `PONG`；若 Redis 启用认证，使用你现有的安全认证方式执行。`PING` 只证明 Redis 可连接，不证明 Session 自动配置已生效。
3. **清理旧会话并重新登录一次。** 从容器内存 Session 切换至 Redis 后，旧 `JSESSIONID` 不会自动迁移。通过项目原有 `POST /api/user/login` 正常登录。
4. **看浏览器开发者工具。** 登录响应应设置由 Spring Session 管理的 `SESSION` Cookie；后续 `POST /api/user/get/login` 请求应携带该 Cookie，并返回当前用户。注意同一主机名、Cookie 的 Path/有效期，以及请求是否携带凭据。
5. **查 Redis 键。** 登录后执行只读扫描（不要使用 `FLUSHDB` 或清空整个 Redis）：

   ```bash
   redis-cli -h 127.0.0.1 -p 6379 --scan --pattern 'ai-code-mother:session:sessions:*'
   ```

   正常情况下应出现以该命名空间开头的 Session 键。选其中一个实际键检查剩余生存时间：

   ```bash
   redis-cli -h 127.0.0.1 -p 6379 TTL 'ai-code-mother:session:sessions:<实际会话ID>'
   ```

   `TTL` 为正值代表键有过期时间；`-2` 表示键不存在；`-1` 表示键未设置过期。这里的剩余时间会随访问和保存行为变化，不要求恰好等于初始配置秒数。勿公开真实 Session ID。
6. **验证重启。** 保持 Redis 和浏览器 Cookie 不变，只重启后端服务。然后在同一浏览器再次调用 `POST /api/user/get/login`。若 Redis Session 尚未过期，应仍识别为同一用户；正常登出后不应再被识别为已登录。
7. **验证多实例（需要时）。** 两个后端实例指向同一 Redis 数据库和相同 `namespace`，浏览器通过同一对外域名访问；在实例 A 登录后让实例 B 处理 `get/login`，确认登录态可共享。

> 重新启动的是**应用服务**，不是 Redis。若 Redis 自己也重启，能否保留会话还取决于 Redis 的持久化与数据是否仍在；Cookie 存在不能恢复已经丢失的 Redis 键。

## 5. 常见排查

| 现象 | 优先检查 |
| --- | --- |
| 登录成功但没有 `ai-code-mother:session:sessions:*` 键 | 是否重新加载 Boot starter、是否以新进程启动、是否真的调用登录接口、是否连到了同一 Redis 数据库/命名空间；检查启动条件报告中 `SessionDataRedisAutoConfiguration` 是否生效 |
| 浏览器仍出现 `JSESSIONID`，重启即失效 | 实际处理请求的后端是否仍是旧进程或旧构建；检查 `springSessionRepositoryFilter` 是否存在，以及负载均衡是否指向了不同版本实例 |
| 有 `SESSION` Cookie，但约 30 分钟后需重新登录 | `spring.session.timeout` 未设置；Cookie 三天仅表示浏览器保留会话标识，并不延长 Redis Session |
| 浏览器登录后下一次请求立即未登录 | Network 面板检查是否回传 `SESSION`；前端是否使用 `localhost`、后端却使用 `127.0.0.1`；确认 CORS 凭据与 Cookie Path/SameSite 设置。若是跨站 HTTPS 部署，再按实际域名配置 SameSite 和 Secure |
| Redis 有 AI 记忆键，没有用户 Session 键 | `RedisChatMemoryStore` 与 Spring Session 是独立的；检查 Boot starter 和 Session 自动配置，不要用 AI 的 `ttl` 推断登录会话状态 |
| Redis 报 `NOAUTH`、连接拒绝或超时 | 对齐 Redis 的 host、port、认证信息和运行环境；容器中的 `localhost` 指容器自身，不一定是 Redis 宿主机 |
| 服务重启后 Redis 有键但登录失效 | 比较新旧进程的 Redis 数据库、namespace、Cookie 主机和序列化兼容性；先确认服务是否在 Session TTL 内重启完成 |

## 6. 与现有代码的关系及后续注意事项

- `UserServiceImpl` 把完整 `User` 存入 Session。该对象虽已实现 `Serializable`，但包含密码哈希等无需保存在登录态中的字段；后续可考虑只存用户 ID，再从数据库读取实时用户信息。这是独立优化，**不属于启用 Redis Session 的前置条件**。
- Spring Session 默认用 Java 序列化保存 Session 属性。跨版本发布、多个实例运行不同版本时，应关注序列化兼容性；不要在已有 Session 仍有效时任意修改用户对象的序列化格式。
- `spring.data.redis.ttl` 是当前项目自定义给 AI 聊天记忆的配置，与 `spring.session.timeout` 分别管理。聊天历史的持久化则由项目 ChatHistory 模块负责。
- 想让用户**绝对时间**到期后强制重新登录，或支持撤销全部登录设备，需要额外设计；简单的 `spring.session.timeout: 3d` 表示不活动超时，不能等同于绝对 3 天。

## 官方资料

- [Spring Boot 4.1 Spring Session 自动配置](https://docs.spring.io/spring-boot/4.1/reference/web/spring-session.html)
- [Spring Boot 4.1 配置属性：Session / Redis / Cookie](https://docs.spring.io/spring-boot/4.1/appendix/application-properties/index.html)
- [Spring Session：Spring Boot + Redis 使用指南](https://docs.spring.io/spring-session/reference/guides/boot-redis.html)
- [Spring Session：Redis 存储与序列化](https://docs.spring.io/spring-session/reference/configuration/redis.html)
