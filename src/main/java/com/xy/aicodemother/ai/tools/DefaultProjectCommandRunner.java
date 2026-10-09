package com.xy.aicodemother.ai.tools;

import com.xy.aicodemother.config.ProjectToolProperties;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * 工程命令执行器：默认使用 Docker，local 模式须由开发者显式开启。
 *
 * <p>容器仅挂载当前构建快照，不挂载后端目录、密钥或 Docker socket；禁用额外权限，
 * 限制 CPU、内存和进程数量。日志持续读取但只保留最后 64 KiB 字符，避免子进程因输出缓冲区
 * 堵塞或大量日志耗尽 JVM 内存。超时/取消时同时终止进程树和容器。</p>
 */
@Component
public class DefaultProjectCommandRunner implements ProjectCommandRunner {

    private static final int MAX_LOG_CHARS = 64 * 1024;

    @Override
    public CommandResult run(Path workingDirectory, List<String> arguments, ProjectToolProperties properties) {
        String mode = properties.getExecutionMode();
        if (!"docker".equalsIgnoreCase(mode) && !"local".equalsIgnoreCase(mode)) {
            return new CommandResult("CONFIGURATION_ERROR", -1, "execution-mode 只支持 docker 或 local");
        }
        boolean docker = "docker".equalsIgnoreCase(mode);
        String containerName = "ai-project-build-" + UUID.randomUUID();
        Process process = null;
        Thread reader = null;
        BoundedLog log = new BoundedLog();
        try {
            List<String> command = docker
                    ? dockerCommand(workingDirectory, arguments, properties, containerName)
                    : localCommand(arguments, properties);
            ProcessBuilder builder = new ProcessBuilder(command).directory(workingDirectory.toFile())
                    .redirectErrorStream(true);
            configureEnvironment(builder.environment(), workingDirectory, docker);
            process = builder.start();
            Process runningProcess = process;
            reader = Thread.ofPlatform().daemon().name("project-command-log").start(() -> {
                try (InputStreamReader input = new InputStreamReader(runningProcess.getInputStream(), StandardCharsets.UTF_8)) {
                    char[] buffer = new char[2048];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        log.append(buffer, count);
                    }
                } catch (IOException ignored) {
                    // 超时终止进程时输出流会关闭，保留已经读取的日志即可。
                }
            });
            long timeout = Math.max(1, properties.getCommandTimeoutSeconds());
            if (!process.waitFor(timeout, TimeUnit.SECONDS)) {
                terminate(process);
                if (docker) {
                    removeContainer(containerName);
                }
                joinReader(reader);
                return new CommandResult("TIMEOUT", -1, log.contents() + "\n命令执行超时（" + timeout + " 秒）");
            }
            joinReader(reader);
            int exitCode = process.exitValue();
            String output = log.contents();
            String status = exitCode == 0 ? "SUCCESS" : "COMMAND_FAILED";
            if (docker && exitCode == 125) {
                status = "RUNTIME_UNAVAILABLE";
                output += "\n请确认 Docker 服务已启动，且已预先准备镜像 " + properties.getDockerImage()
                        + "（执行器不会自动拉取镜像）";
            }
            return new CommandResult(status, exitCode, output);
        } catch (InterruptedException e) {
            if (process != null) {
                terminate(process);
            }
            if (docker) {
                removeContainer(containerName);
            }
            Thread.currentThread().interrupt();
            return new CommandResult("CANCELLED", -1, log.contents() + "\n工程任务已取消");
        } catch (IOException e) {
            return new CommandResult("RUNTIME_UNAVAILABLE", -1,
                    docker ? "无法启动 Docker，请确认 Docker 已安装并运行"
                            : "无法启动 npm，请确认 local 模式的 npm-executable 和 Node 环境配置");
        } finally {
            if (process != null && process.isAlive()) {
                terminate(process);
            }
            if (reader != null && reader.isAlive() && process != null) {
                try {
                    process.getInputStream().close();
                } catch (IOException ignored) {
                    // 仅清理本次命令资源。
                }
            }
        }
    }

    /** Docker 命令不经过 shell，模型无法拼接额外参数或宿主机挂载。 */
    private List<String> dockerCommand(Path directory, List<String> arguments,
                                       ProjectToolProperties properties, String name) throws IOException {
        if (properties.getDockerImage() == null || properties.getDockerImage().isBlank()) {
            throw new IOException("Docker 镜像未配置");
        }
        List<String> command = new ArrayList<>(List.of("docker", "run", "--rm", "--pull=never", "--name", name,
                "--cpus=1", "--memory=512m", "--pids-limit=128", "--cap-drop=ALL",
                "--security-opt=no-new-privileges", "--read-only", "--tmpfs", "/tmp:rw,nosuid,size=256m",
                "--mount", "type=bind,src=" + directory.toAbsolutePath() + ",dst=/workspace",
                "--workdir", "/workspace", "--env", "HOME=/tmp", "--env", "CI=true",
                "--env", "npm_config_cache=/tmp/npm-cache", "--env", "npm_config_userconfig=/dev/null",
                "--env", "npm_config_ignore_scripts=true"));
        // 只有依赖安装需要访问 registry；执行生成的检查/构建脚本时完全禁用容器网络。
        boolean installing = !arguments.isEmpty()
                && ("ci".equals(arguments.getFirst()) || "install".equals(arguments.getFirst()));
        command.add(installing ? "--network=bridge" : "--network=none");
        // 使用快照所有者的 UID/GID，避免容器产物变成宿主机不可清理的 root 文件。
        try {
            int uid = ((Number) Files.getAttribute(directory, "unix:uid")).intValue();
            int gid = ((Number) Files.getAttribute(directory, "unix:gid")).intValue();
            command.add("--user=" + uid + ":" + gid);
        } catch (UnsupportedOperationException ignored) {
            command.add("--user=node");
        }
        command.add(properties.getDockerImage());
        command.add("npm");
        command.addAll(arguments);
        return command;
    }

    private List<String> localCommand(List<String> arguments, ProjectToolProperties properties) {
        List<String> command = new ArrayList<>();
        command.add(properties.getNpmExecutable());
        command.addAll(arguments);
        return command;
    }

    /** 不继承 API 密钥等宿主机环境变量；Docker 客户端 HOME 仅用于定位本机 daemon context。 */
    private void configureEnvironment(Map<String, String> environment, Path directory, boolean docker) throws IOException {
        String path = environment.get("PATH");
        String systemRoot = environment.get("SystemRoot");
        environment.clear();
        if (path != null) {
            environment.put("PATH", path);
        }
        if (systemRoot != null) {
            environment.put("SystemRoot", systemRoot);
        }
        if (docker) {
            environment.put("HOME", System.getProperty("user.home"));
        } else {
            Path home = directory.resolve(".runner-home");
            Files.createDirectories(home);
            environment.put("HOME", home.toString());
            environment.put("CI", "true");
            environment.put("npm_config_cache", home.resolve("npm-cache").toString());
            environment.put("npm_config_userconfig", "/dev/null");
            environment.put("npm_config_ignore_scripts", "true");
        }
    }

    /** 先记录后代进程再终止父进程，避免 npm 的子进程在取消后继续运行。 */
    private void terminate(Process process) {
        List<ProcessHandle> descendants;
        try {
            descendants = process.descendants().toList();
        } catch (RuntimeException e) {
            // 某些 macOS 沙箱禁止枚举进程（sysctl）；仍终止父进程，Docker 模式另外移除容器。
            descendants = List.of();
        }
        for (ProcessHandle child : descendants.reversed()) {
            try {
                child.destroy();
            } catch (RuntimeException ignored) {
                // 不因单个受限进程跳过后续父进程清理。
            }
        }
        process.destroy();
        for (ProcessHandle child : descendants.reversed()) {
            try {
                if (child.isAlive()) {
                    child.destroyForcibly();
                }
            } catch (RuntimeException ignored) {
                // 容器清理会兜底杀死容器中剩余进程。
            }
        }
        if (process.isAlive()) {
            process.destroyForcibly();
        }
    }

    private void removeContainer(String name) {
        try {
            ProcessBuilder builder = new ProcessBuilder("docker", "rm", "--force", name)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(ProcessBuilder.Redirect.DISCARD);
            configureEnvironment(builder.environment(), Path.of(System.getProperty("java.io.tmpdir")), true);
            Process cleanup = builder.start();
            if (!cleanup.waitFor(5, TimeUnit.SECONDS)) {
                cleanup.destroyForcibly();
            }
        } catch (IOException | InterruptedException ignored) {
            // 原任务状态会明确报告失败；清理尽力完成且不覆盖原失败信息。
        }
    }

    private void joinReader(Thread reader) throws InterruptedException {
        reader.join(2000);
    }

    /** 达到上限后仍持续排空管道，只停止保存日志。 */
    private static final class BoundedLog {
        private final StringBuilder value = new StringBuilder();
        private boolean truncated;

        synchronized void append(char[] data, int count) {
            int overflow = value.length() + count - MAX_LOG_CHARS;
            if (overflow > 0) {
                value.delete(0, Math.min(value.length(), overflow));
                truncated = true;
            }
            int offset = Math.max(0, count - MAX_LOG_CHARS);
            value.append(data, offset, count - offset);
        }

        synchronized String contents() {
            return (truncated ? "[前部日志已截断，保留最后 64 KiB 字符]\n" : "") + value;
        }
    }
}
