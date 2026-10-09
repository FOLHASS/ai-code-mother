package com.xy.aicodemother.config;

import com.xy.aicodemother.constant.AppConstant;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 工程工具的运行参数，支持通过 project.tools.* 配置或环境变量覆盖。
 *
 * <p>文件操作只允许当前应用的工程目录；执行默认使用 Docker 容器。
 * local 模式仅用于开发者信任的本地项目，它不提供容器隔离。</p>
 */
@Data
@Component
@ConfigurationProperties(prefix = "project.tools")
public class ProjectToolProperties {

    /** 源码根目录，具体工程目录为 vue_project_{appId}。 */
    private String workspaceRoot = AppConstant.CODE_OUTPUT_ROOT_DIR;

    /** 构建快照根目录，不作为网站静态资源目录对外提供。 */
    private String buildRoot = AppConstant.CODE_BUILD_ROOT_DIR;

    /** 成功发布的 dist 内容根目录，源码和预览产物分别保存。 */
    private String previewRoot = AppConstant.CODE_PREVIEW_ROOT_DIR;

    /** 返回给前端的预览服务地址，可按实际部署域名配置。 */
    private String previewBaseUrl = "http://localhost:8123/api/static";

    /** 单个文本文件允许读取或写入的最大字节数，默认 1 MiB。 */
    private long maxFileBytes = 1024 * 1024;

    /** 单次目录查询返回的最大条目数，避免将整个大型项目塞入模型上下文。 */
    private int maxListEntries = 1000;

    /** 单次文字搜索返回的最大匹配数。 */
    private int maxSearchResults = 100;

    /** 构建执行方式：docker（默认）或 local（可信本地开发）。 */
    private String executionMode = "docker";

    /** 构建容器的 Node 镜像，服务器应预先准备该镜像。 */
    private String dockerImage = "node:22-bookworm-slim";

    /** local 模式的 npm 可执行程序，仅由服务端配置，模型不能传入命令。 */
    private String npmExecutable = "npm";

    /** 每条固定安装、检查或构建命令的执行超时（秒）。 */
    private long commandTimeoutSeconds = 120;

    /** 当前后端进程允许并行运行的最大构建任务数。 */
    private int maxConcurrentBuilds = 2;

    /** 是否在构建快照中安装依赖；安装时禁止 npm 生命周期脚本。 */
    private boolean installDependencies = true;
}
