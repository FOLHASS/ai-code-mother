package com.xy.aicodemother.ai.tools;

import com.xy.aicodemother.config.ProjectToolProperties;

import java.nio.file.Path;
import java.util.List;

/**
 * 固定工程命令的执行边界。
 *
 * <p>命令只能由后端构建服务生成，不向模型开放任意命令参数。接口便于在测试中
 * 使用假执行器，避免测试启动 Docker、安装依赖或访问网络。</p>
 */
public interface ProjectCommandRunner {

    /**
     * 在独立构建快照中执行命令，返回有界日志和明确的执行状态。
     *
     * @param workingDirectory 当前应用本次构建的快照目录
     * @param arguments 服务端生成的 npm 命令参数
     * @param properties 服务端执行配置
     * @return 执行结果；非零退出、超时和运行时缺失均不能视为成功
     */
    CommandResult run(Path workingDirectory, List<String> arguments, ProjectToolProperties properties);

    /** 命令结果。status 为 SUCCESS、COMMAND_FAILED、TIMEOUT、CANCELLED 或 RUNTIME_UNAVAILABLE。 */
    record CommandResult(String status, int exitCode, String logs) {

        /** 仅退出码为 0 且状态成功时允许继续构建或发布。 */
        public boolean successful() {
            return "SUCCESS".equals(status) && exitCode == 0;
        }
    }
}
