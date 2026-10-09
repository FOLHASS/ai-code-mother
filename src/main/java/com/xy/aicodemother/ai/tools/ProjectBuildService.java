package com.xy.aicodemother.ai.tools;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.xy.aicodemother.ai.tools.model.ProjectBuildResult;
import com.xy.aicodemother.ai.tools.model.ProjectPreviewResult;
import com.xy.aicodemother.config.ProjectToolProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;

/**
 * Vue/Vite 工程检查、构建和预览发布服务。
 *
 * <p>每次执行先复制源码快照，npm 永远不会在真实源码目录中运行。构建成功后保存独立
 * dist 产物；发布前重新校验源码指纹，避免展示已过期的构建。失败构建不会覆盖上一版
 * 预览。所有文件操作工具和本服务通过 ProjectWorkspace 共用应用级锁。</p>
 */
@Slf4j
@Service
public class ProjectBuildService {

    private static final int MAX_LOG_CHARS = 64 * 1024;
    private final ProjectWorkspace workspace;
    private final ProjectToolProperties properties;
    private final ProjectCommandRunner runner;
    private final Semaphore buildSlots;
    private final ConcurrentHashMap<Long, BuildArtifact> builds = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, PublishedArtifact> published = new ConcurrentHashMap<>();

    public ProjectBuildService(ProjectWorkspace workspace, ProjectToolProperties properties, ProjectCommandRunner runner) {
        this.workspace = workspace;
        this.properties = properties;
        this.runner = runner;
        this.buildSlots = new Semaphore(Math.max(1, properties.getMaxConcurrentBuilds()));
    }

    /**
     * 执行 package.json 中已有的 type-check 或 typecheck 脚本。
     *
     * <p>不自动创造脚本，也不让模型指定 shell 命令；缺少脚本会返回 CONFIGURATION_ERROR，
     * 模型可以据此补齐工程配置。检查成功只证明本次快照通过类型检查，不会发布预览。</p>
     */
    public ProjectBuildResult typeCheck(Long appId) {
        return execute(appId, true);
    }

    /**
     * 安装依赖并执行固定的 build 脚本，校验 dist/index.html 后保存不可变产物。
     * buildId 必须交给 publish_preview，构建本身不会修改已发布的网站。
     */
    public ProjectBuildResult buildProject(Long appId) {
        return execute(appId, false);
    }

    /**
     * 发布本应用最近一次成功构建，要求 buildId 和当前源码指纹均匹配。
     *
     * @param appId 服务端绑定的应用标识
     * @param buildId build_project 返回的成功构建标识，不能跨应用使用
     * @return 指向 dist 内容的预览 URL
     */
    public ProjectPreviewResult publishPreview(Long appId, String buildId) {
        return workspace.withProjectLock(appId, () -> {
            requireActive(appId);
            BuildArtifact artifact = builds.get(appId);
            if (artifact == null || buildId == null || !buildId.equals(artifact.buildId())) {
                throw new ProjectWorkspace.WorkspaceException("找不到本应用对应的成功构建，请先调用 build_project");
            }
            if (!artifact.fingerprint().equals(workspace.fingerprint(appId))) {
                throw new ProjectWorkspace.WorkspaceException("源码已修改，本次构建已过期，请重新调用 build_project");
            }
            validateRoots();
            Path previewRoot = managedRoot(properties.getPreviewRoot());
            Path target = previewRoot.resolve(projectName(appId));
            Path staging = previewRoot.resolve("." + projectName(appId) + "-" + UUID.randomUUID());
            Path backup = previewRoot.resolve("." + projectName(appId) + "-backup-" + UUID.randomUUID());
            boolean previousMoved = false;
            boolean replacementMoved = false;
            try {
                copyDistribution(artifact.directory(), staging);
                // 先完整复制到暂存目录，只有校验通过后才切换预览版本。
                if (Files.exists(target, LinkOption.NOFOLLOW_LINKS)) {
                    if (Files.isSymbolicLink(target) || !Files.isDirectory(target, LinkOption.NOFOLLOW_LINKS)) {
                        throw new IOException("预览目录必须为普通目录");
                    }
                    moveDirectory(target, backup);
                    previousMoved = true;
                }
                moveDirectory(staging, target);
                replacementMoved = true;
                published.put(appId, new PublishedArtifact(artifact.buildId(), artifact.fingerprint()));
                String url = previewUrl(appId);
                return new ProjectPreviewResult(true, url, artifact.buildId(), "构建产物已发布，可以展示网站");
            } catch (IOException e) {
                if (previousMoved && !replacementMoved) {
                    try {
                        moveDirectory(backup, target);
                    } catch (IOException restoreError) {
                        log.error("恢复应用 {} 的上次预览失败", appId, restoreError);
                    }
                }
                log.warn("发布应用 {} 的预览失败", appId, e);
                throw new ProjectWorkspace.WorkspaceException("预览发布失败，上一版产物已保留，请重试");
            } finally {
                deleteQuietly(staging);
                if (replacementMoved) {
                    deleteQuietly(backup);
                }
            }
        });
    }

    /**
     * 为生成流程或部署操作确保最新源码拥有可访问预览。
     *
     * <p>同一源码已发布时直接复用；若模型只写入文件而没有主动调用构建工具，此方法
     * 仍会补齐构建和发布。运行时缺失、构建失败或源码发生竞争修改时明确报错。</p>
     */
    public String ensurePreview(Long appId) {
        return workspace.withProjectLock(appId, () -> ensurePreviewLocked(appId));
    }

    /** 复用判断与后续构建/发布统一持锁，不会在两次检查之间切入文件编辑或删除。 */
    private String ensurePreviewLocked(Long appId) {
        requireActive(appId);
        String fingerprint = workspace.withProjectLock(appId, () -> workspace.fingerprint(appId));
        PublishedArtifact existing = published.get(appId);
        Path target = getPublishedDirectory(appId);
        if (existing != null && existing.fingerprint().equals(fingerprint)
                && Files.isRegularFile(target.resolve("index.html"), LinkOption.NOFOLLOW_LINKS)) {
            return previewUrl(appId);
        }
        BuildArtifact artifact = builds.get(appId);
        if (artifact == null || !artifact.fingerprint().equals(fingerprint)) {
            ProjectBuildResult result = buildProject(appId);
            if (!result.success()) {
                throw failure("工程构建失败（" + result.status() + "）：" + result.logs());
            }
            artifact = builds.get(appId);
        }
        return publishPreview(appId, artifact.buildId()).previewUrl();
    }

    /** 返回已发布 dist 的位置，供部署复制使用；不会返回源码目录。 */
    public Path getPublishedDirectory(Long appId) {
        workspace.projectRoot(appId); // 统一执行 appId 校验。
        try {
            Path result = managedRoot(properties.getPreviewRoot()).resolve(projectName(appId));
            if (Files.isSymbolicLink(result)) {
                throw failure("预览目录不允许使用符号链接");
            }
            return result;
        } catch (IOException e) {
            throw failure("无法访问预览目录，请检查服务端配置");
        }
    }

    /**
     * 删除应用时关联清理源码、私有构建快照和公开预览，并清空成功构建缓存。
     *
     * <p>与整次构建/发布共用应用锁：删除等待正在进行的构建结束；删除标记阻止已经排队
     * 的构建任务重新发布该应用。应用标识不可复用。部署目录仍由应用服务按 deployKey 清理。</p>
     */
    public void deleteProjectArtifacts(Long appId) {
        if (workspace.isDeleted(appId)) {
            return;
        }
        workspace.withProjectLock(appId, () -> {
            builds.remove(appId);
            published.remove(appId);
            validateRoots();
            deleteQuietly(workspace.projectRoot(appId));
            Path previewRoot = managedRoot(properties.getPreviewRoot());
            deleteQuietly(previewRoot.resolve(projectName(appId)));
            try (var entries = Files.list(previewRoot)) {
                entries.filter(path -> path.getFileName().toString().startsWith("." + projectName(appId) + "-"))
                        .forEach(this::deleteQuietly);
            }
            Path buildRoot = managedRoot(properties.getBuildRoot());
            try (var entries = Files.list(buildRoot)) {
                entries.filter(path -> path.getFileName().toString().startsWith(projectName(appId) + "-"))
                        .forEach(this::deleteQuietly);
            }
            // 资源清理完成后封禁上下文，禁止尚未结束的 AI 继续通过文件工具重建工程。
            workspace.markDeleted(appId);
            return null;
        });
    }

    private ProjectBuildResult execute(Long appId, boolean checkOnly) {
        // 持有锁直至快照和产物处理结束，删除/发布不会在构建中途清理或替换目录。
        return workspace.withProjectLock(appId, () -> executeLocked(appId, checkOnly));
    }

    private ProjectBuildResult executeLocked(Long appId, boolean checkOnly) {
        requireActive(appId);
        workspace.projectRoot(appId);
        if (!buildSlots.tryAcquire()) {
            return new ProjectBuildResult(false, "BUSY", null, null, "当前构建任务较多，请稍后重试");
        }
        String buildId = UUID.randomUUID().toString();
        String fingerprint = null;
        Path jobRoot = null;
        boolean keepArtifact = false;
        StringBuilder logs = new StringBuilder();
        try {
            validateRoots();
            Path buildRoot = managedRoot(properties.getBuildRoot());
            jobRoot = buildRoot.resolve(projectName(appId) + "-" + buildId);
            Files.createDirectory(jobRoot);
            Path snapshot = jobRoot.resolve("source");
            fingerprint = workspace.withProjectLock(appId, () -> {
                String hash = workspace.fingerprint(appId);
                workspace.copySource(appId, snapshot);
                return hash;
            });
            Path packageFile = snapshot.resolve("package.json");
            if (!Files.isRegularFile(packageFile, LinkOption.NOFOLLOW_LINKS)
                    || Files.size(packageFile) > 1024 * 1024) {
                return failed("CONFIGURATION_ERROR", buildId, fingerprint, "缺少有效 package.json，请先补齐 Vite 工程配置");
            }
            JSONObject packageJson;
            try {
                packageJson = JSONUtil.parseObj(Files.readString(packageFile, StandardCharsets.UTF_8));
            } catch (RuntimeException e) {
                return failed("CONFIGURATION_ERROR", buildId, fingerprint, "package.json 格式不正确，请修复 JSON 后重试");
            }
            JSONObject scripts = packageJson.getJSONObject("scripts");
            String script = checkOnly ? typeCheckScript(scripts) : "build";
            if (scripts == null || script == null || scripts.getStr(script, "").isBlank()) {
                return failed("CONFIGURATION_ERROR", buildId, fingerprint,
                        checkOnly ? "package.json 未提供 type-check 或 typecheck 脚本"
                                : "package.json 未提供 build 脚本");
            }
            if (properties.isInstallDependencies()) {
                String install = Files.isRegularFile(snapshot.resolve("package-lock.json"), LinkOption.NOFOLLOW_LINKS)
                        ? "ci" : "install";
                ProjectCommandRunner.CommandResult installation = runner.run(snapshot,
                        List.of(install, "--ignore-scripts", "--no-audit", "--no-fund"), properties);
                appendLog(logs, "[安装依赖]\n" + installation.logs());
                if (!installation.successful()) {
                    return failed(installation.status(), buildId, fingerprint, logs.toString());
                }
            }
            // 固定 Vite base 为相对路径，让预览 /api/static/... 和部署 /deployKey/ 均可访问资源。
            List<String> command = checkOnly ? List.of("run", script)
                    : List.of("run", "build", "--", "--base=./");
            ProjectCommandRunner.CommandResult execution = runner.run(snapshot, command, properties);
            appendLog(logs, "[" + (checkOnly ? "类型检查" : "构建") + "]\n" + execution.logs());
            if (!execution.successful()) {
                return failed(execution.status(), buildId, fingerprint, logs.toString());
            }
            String currentFingerprint = workspace.withProjectLock(appId, () -> workspace.fingerprint(appId));
            if (!fingerprint.equals(currentFingerprint)) {
                return failed("STALE_SOURCE", buildId, fingerprint, "执行期间源码已修改，请针对最新文件重新构建");
            }
            if (!checkOnly) {
                Path artifact = jobRoot.resolve("artifact");
                copyDistribution(snapshot.resolve("dist"), artifact);
                BuildArtifact previous = builds.put(appId, new BuildArtifact(buildId, fingerprint, artifact));
                keepArtifact = true;
                if (previous != null) {
                    deleteQuietly(previous.directory().getParent());
                }
            }
            return new ProjectBuildResult(true, "SUCCESS", buildId, fingerprint, logs.toString());
        } catch (Exception e) {
            log.warn("应用 {} 的工程{}失败", appId, checkOnly ? "检查" : "构建", e);
            appendLog(logs, "\n工程配置或产物校验失败：" + safeMessage(e));
            return failed("VALIDATION_FAILED", buildId, fingerprint, logs.toString());
        } finally {
            if (jobRoot != null) {
                if (keepArtifact) {
                    deleteQuietly(jobRoot.resolve("source"));
                } else {
                    deleteQuietly(jobRoot);
                }
            }
            buildSlots.release();
        }
    }

    /** 源码、私有构建和公开预览三类目录不得相互包含或重叠。 */
    private void validateRoots() throws IOException {
        List<Path> roots = List.of(managedRoot(properties.getBuildRoot()),
                managedRoot(properties.getPreviewRoot()), managedRoot(properties.getWorkspaceRoot()));
        for (int i = 0; i < roots.size(); i++) {
            for (int j = i + 1; j < roots.size(); j++) {
                if (roots.get(i).startsWith(roots.get(j)) || roots.get(j).startsWith(roots.get(i))) {
                    throw new IOException("工程源码、构建和预览根目录必须相互独立");
                }
            }
        }
    }

    private void requireActive(Long appId) {
        if (workspace.isDeleted(appId)) {
            throw new ProjectWorkspace.WorkspaceException("应用已删除，不能继续检查、构建或发布");
        }
    }

    private String typeCheckScript(JSONObject scripts) {
        if (scripts == null) {
            return null;
        }
        if (!scripts.getStr("type-check", "").isBlank()) {
            return "type-check";
        }
        return scripts.getStr("typecheck", "").isBlank() ? null : "typecheck";
    }

    /**
     * 管理员配置的根目录解析为真实路径，支持 macOS /var、/tmp 等系统目录链接；
     * 应用目录及产物中的链接仍会逐项拒绝。
     */
    private Path managedRoot(String configuredRoot) throws IOException {
        Path root = Path.of(configuredRoot).toAbsolutePath().normalize();
        Files.createDirectories(root);
        return root.toRealPath();
    }

    /** 不跟随任何符号链接，只允许普通目录和普通文件，且必须存在 index.html。 */
    private void copyDistribution(Path source, Path destination) throws IOException {
        if (!Files.isDirectory(source, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(source)
                || !Files.isRegularFile(source.resolve("index.html"), LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException("构建未生成有效 dist/index.html，请检查 Vite 的输出配置");
        }
        Files.walkFileTree(source, new SimpleFileVisitor<>() {
            private int entries;
            private long bytes;

            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                if (++entries > 10_000) {
                    throw new IOException("构建产物文件数量超过限制");
                }
                if (attrs.isSymbolicLink()) {
                    throw new IOException("构建产物包含符号链接");
                }
                Files.createDirectories(destination.resolve(source.relativize(dir).toString()));
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                if (attrs.isSymbolicLink() || !attrs.isRegularFile()) {
                    throw new IOException("构建产物只能包含普通文件，不允许符号链接");
                }
                bytes += attrs.size();
                if (++entries > 10_000 || bytes > 256L * 1024 * 1024 || attrs.size() > 64L * 1024 * 1024) {
                    throw new IOException("构建产物数量或大小超过限制");
                }
                Files.copy(file, destination.resolve(source.relativize(file).toString()));
                return FileVisitResult.CONTINUE;
            }
        });
    }

    private void moveDirectory(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(source, target);
        }
    }

    /** 清理时不跟随链接，node_modules 的内部链接也不会导致删除工作目录以外的文件。 */
    private void deleteQuietly(Path directory) {
        if (!Files.exists(directory, LinkOption.NOFOLLOW_LINKS)) {
            return;
        }
        try {
            Files.walkFileTree(directory, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.delete(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException error) throws IOException {
                    if (error != null) {
                        throw error;
                    }
                    Files.delete(dir);
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            log.warn("工程临时目录清理失败，需由服务器定期清理", e);
        }
    }

    private ProjectBuildResult failed(String status, String buildId, String fingerprint, String message) {
        return new ProjectBuildResult(false, status, buildId, fingerprint, message);
    }

    private void appendLog(StringBuilder logs, String value) {
        int overflow = logs.length() + value.length() - MAX_LOG_CHARS;
        if (overflow > 0) {
            logs.delete(0, Math.min(logs.length(), overflow));
        }
        int offset = Math.max(0, value.length() - MAX_LOG_CHARS);
        // 保留最新日志，避免安装输出占满预算后把真正的构建错误丢掉。
        logs.append(value, offset, value.length());
    }

    private String safeMessage(Exception e) {
        if (e instanceof ProjectWorkspace.WorkspaceException) {
            return e.getMessage();
        }
        if (e instanceof IOException) {
            String message = e.getMessage();
            // 文件系统异常常含宿主机绝对路径；仅返回本服务主动给出的说明。
            return message != null && (message.startsWith("构建") || message.startsWith("工程"))
                    ? message : "目录访问失败，请检查服务端工程目录配置";
        }
        return "工程快照或配置无效，请检查源码和 package.json";
    }

    private String projectName(Long appId) {
        return "vue_project_" + appId;
    }

    private String previewUrl(Long appId) {
        return properties.getPreviewBaseUrl().replaceAll("/+$", "") + "/" + projectName(appId) + "/";
    }

    private ProjectWorkspace.WorkspaceException failure(String message) {
        // Workspace 锁会保留此类业务说明，避免构建日志被普通异常包装成模糊错误。
        return new ProjectWorkspace.WorkspaceException(message);
    }

    private record BuildArtifact(String buildId, String fingerprint, Path directory) {
    }

    private record PublishedArtifact(String buildId, String fingerprint) {
    }
}
