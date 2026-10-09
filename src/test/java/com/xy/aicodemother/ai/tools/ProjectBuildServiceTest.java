package com.xy.aicodemother.ai.tools;

import com.xy.aicodemother.ai.tools.model.ProjectBuildResult;
import com.xy.aicodemother.ai.tools.model.ProjectPreviewResult;
import com.xy.aicodemother.config.ProjectToolProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/** 使用假命令执行器验证工程构建/发布约束，不启动 Docker 或 npm，不访问真实 AI。 */
class ProjectBuildServiceTest {

    @TempDir
    Path tempDirectory;

    private ProjectToolProperties properties;
    private ProjectWorkspace workspace;
    private FakeRunner runner;
    private ProjectBuildService service;

    @BeforeEach
    void setUp() throws IOException {
        properties = new ProjectToolProperties();
        properties.setWorkspaceRoot(tempDirectory.resolve("projects").toString());
        properties.setBuildRoot(tempDirectory.resolve("builds").toString());
        properties.setPreviewRoot(tempDirectory.resolve("previews").toString());
        properties.setPreviewBaseUrl("http://localhost:8123/api/static/");
        properties.setInstallDependencies(false);
        workspace = new ProjectWorkspace(properties);
        runner = new FakeRunner();
        service = new ProjectBuildService(workspace, properties, runner);
        createProject(1L, "{\"scripts\":{\"build\":\"vite build\",\"type-check\":\"vue-tsc --noEmit\"}}");
    }

    @Test
    void buildsSnapshotAndPublishesOnlyDist() throws IOException {
        ProjectBuildResult build = service.buildProject(1L);
        assertTrue(build.success());
        assertFalse(Files.exists(service.getPublishedDirectory(1L).resolve("index.html")));
        ProjectPreviewResult preview = service.publishPreview(1L, build.buildId());
        assertEquals("http://localhost:8123/api/static/vue_project_1/", preview.previewUrl());
        Path directory = service.getPublishedDirectory(1L);
        assertEquals("version-1", Files.readString(directory.resolve("index.html")));
        assertFalse(Files.exists(directory.resolve("package.json")));
        assertFalse(Files.exists(directory.resolve("src")));
        assertTrue(Files.exists(workspace.projectRoot(1L).resolve("src/App.vue")));
        assertEquals(List.of("run", "build", "--", "--base=./"), runner.commands.getFirst());
        assertNotEquals(workspace.projectRoot(1L), runner.directories.getFirst());
        assertFalse(Files.exists(runner.directories.getFirst()));
    }

    @Test
    void rejectsPublicationWhenSourceChanges() throws IOException {
        ProjectBuildResult build = service.buildProject(1L);
        Files.writeString(workspace.projectRoot(1L).resolve("src/App.vue"), "<template>changed</template>");
        ProjectWorkspace.WorkspaceException error = assertThrows(ProjectWorkspace.WorkspaceException.class,
                () -> service.publishPreview(1L, build.buildId()));
        assertTrue(error.getMessage().contains("过期"));
        assertFalse(Files.exists(service.getPublishedDirectory(1L).resolve("index.html")));
    }

    @Test
    void cannotPublishOtherAppsBuild() throws IOException {
        ProjectBuildResult build = service.buildProject(1L);
        createProject(2L, "{\"scripts\":{\"build\":\"vite build\"}}");
        assertThrows(ProjectWorkspace.WorkspaceException.class, () -> service.publishPreview(2L, build.buildId()));
    }

    @Test
    void failedBuildPreservesPreviousPreview() throws IOException {
        String preview = service.ensurePreview(1L);
        assertTrue(preview.endsWith("vue_project_1/"));
        Files.writeString(workspace.projectRoot(1L).resolve("src/App.vue"), "<template>bad-version</template>");
        runner.failure = new ProjectCommandRunner.CommandResult("COMMAND_FAILED", 1, "Vue syntax error");
        ProjectBuildResult failed = service.buildProject(1L);
        assertFalse(failed.success());
        assertEquals("COMMAND_FAILED", failed.status());
        assertTrue(failed.logs().contains("Vue syntax error"));
        assertEquals("version-1", Files.readString(service.getPublishedDirectory(1L).resolve("index.html")));
    }

    @Test
    void ensurePreviewReusesPublishedUnchangedSource() {
        String first = service.ensurePreview(1L);
        String second = service.ensurePreview(1L);
        assertEquals(first, second);
        assertEquals(1, runner.commands.size());
    }

    @Test
    void supportsOnlyExistingTypeCheckScripts() throws IOException {
        ProjectBuildResult checked = service.typeCheck(1L);
        assertTrue(checked.success());
        assertEquals(List.of("run", "type-check"), runner.commands.getFirst());
        createProject(2L, "{\"scripts\":{\"build\":\"vite build\"}}");
        ProjectBuildResult unsupported = service.typeCheck(2L);
        assertFalse(unsupported.success());
        assertEquals("CONFIGURATION_ERROR", unsupported.status());
        assertTrue(unsupported.logs().contains("type-check"));
    }

    @Test
    void lockFileSelectsNpmCiWithLifecycleScriptsDisabled() throws IOException {
        properties.setInstallDependencies(true);
        Files.writeString(workspace.projectRoot(1L).resolve("package-lock.json"), "{\"lockfileVersion\":3}");
        assertTrue(service.buildProject(1L).success());
        assertEquals(List.of("ci", "--ignore-scripts", "--no-audit", "--no-fund"), runner.commands.getFirst());
        assertEquals(2, runner.commands.size());
    }

    @Test
    void reportsMissingRuntimeWithoutPublishing() {
        runner.failure = new ProjectCommandRunner.CommandResult("RUNTIME_UNAVAILABLE", -1, "Docker 未运行");
        ProjectBuildResult result = service.buildProject(1L);
        assertFalse(result.success());
        assertEquals("RUNTIME_UNAVAILABLE", result.status());
        assertTrue(result.logs().contains("Docker"));
        RuntimeException error = assertThrows(RuntimeException.class, () -> service.ensurePreview(1L));
        assertTrue(error.getMessage().contains("RUNTIME_UNAVAILABLE"));
        assertTrue(error.getMessage().contains("Docker"));
    }

    @Test
    void toolBoundaryReturnsActionableFailuresInsteadOfThrowing() {
        ProjectBuildTools tools = new ProjectBuildTools(service);
        ProjectPreviewResult preview = tools.publishPreview("missing-build", 1L);
        assertFalse(preview.success());
        assertNull(preview.previewUrl());
        assertTrue(preview.message().contains("build_project"));
        ProjectBuildResult build = tools.buildProject(-1L);
        assertFalse(build.success());
        assertTrue(build.logs().contains("应用上下文"));
    }

    @Test
    void missingDistIsNotSuccessfulBuild() {
        runner.createDist = false;
        ProjectBuildResult result = service.buildProject(1L);
        assertFalse(result.success());
        assertEquals("VALIDATION_FAILED", result.status());
        assertTrue(result.logs().contains("dist/index.html"));
    }

    @Test
    void rejectsSymlinkInBuiltDistribution() throws IOException {
        Path outside = tempDirectory.resolve("outside-secret.txt");
        Files.writeString(outside, "private");
        runner.distSymlinkTarget = outside;
        ProjectBuildResult result = service.buildProject(1L);
        assertFalse(result.success());
        assertTrue(result.logs().contains("符号链接"));
        assertFalse(Files.exists(service.getPublishedDirectory(1L).resolve("index.html")));
        assertEquals("private", Files.readString(outside));
    }

    @Test
    void rejectsOverlappingPrivateAndPublicRoots() {
        properties.setPreviewRoot(properties.getWorkspaceRoot());
        ProjectBuildResult result = service.buildProject(1L);
        assertFalse(result.success());
        assertTrue(result.logs().contains("根目录必须相互独立"));
        assertTrue(runner.commands.isEmpty());
    }

    @Test
    void deletionWaitsForBuildAndPreventsResurrection() throws Exception {
        Path sourceDirectory = workspace.projectRoot(1L);
        Path previewDirectory = service.getPublishedDirectory(1L);
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch finish = new CountDownLatch(1);
        runner.entered = entered;
        runner.finish = finish;
        try (var executor = Executors.newFixedThreadPool(2)) {
            var build = executor.submit(() -> service.buildProject(1L));
            assertTrue(entered.await(5, TimeUnit.SECONDS));
            var deletion = executor.submit(() -> service.deleteProjectArtifacts(1L));
            finish.countDown();
            assertTrue(build.get(5, TimeUnit.SECONDS).success());
            deletion.get(5, TimeUnit.SECONDS);
        }
        assertFalse(Files.exists(sourceDirectory));
        assertFalse(Files.exists(previewDirectory));
        assertThrows(ProjectWorkspace.WorkspaceException.class, () -> service.buildProject(1L));
        assertThrows(ProjectWorkspace.WorkspaceException.class, () -> service.publishPreview(1L, "any-build"));
        try (var entries = Files.list(Path.of(properties.getBuildRoot()))) {
            assertEquals(0, entries.count());
        }
    }

    private void createProject(Long appId, String packageJson) throws IOException {
        Path root = workspace.projectRoot(appId);
        Files.createDirectories(root.resolve("src"));
        Files.writeString(root.resolve("package.json"), packageJson);
        Files.writeString(root.resolve("src/App.vue"), "<template>hello</template>");
    }

    /** 模拟真实 runner 的契约：只在构建快照写入 dist，绝不改动应用源码。 */
    private static final class FakeRunner implements ProjectCommandRunner {
        private final List<List<String>> commands = new ArrayList<>();
        private final List<Path> directories = new ArrayList<>();
        private final AtomicInteger versions = new AtomicInteger();
        private CommandResult failure;
        private boolean createDist = true;
        private Path distSymlinkTarget;
        private CountDownLatch entered;
        private CountDownLatch finish;

        @Override
        public CommandResult run(Path workingDirectory, List<String> arguments, ProjectToolProperties ignored) {
            commands.add(arguments);
            directories.add(workingDirectory);
            if (entered != null) {
                entered.countDown();
                try {
                    assertTrue(finish.await(5, TimeUnit.SECONDS));
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return new CommandResult("CANCELLED", -1, "cancelled");
                }
            }
            if (failure != null) {
                return failure;
            }
            if (arguments.contains("build") && createDist) {
                try {
                    Path dist = workingDirectory.resolve("dist");
                    Files.createDirectories(dist.resolve("assets"));
                    Files.writeString(dist.resolve("index.html"), "version-" + versions.incrementAndGet());
                    Files.writeString(dist.resolve("assets/main.js"), "console.log('ok')");
                    if (distSymlinkTarget != null) {
                        Files.createSymbolicLink(dist.resolve("private.txt"), distSymlinkTarget);
                    }
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }
            return new CommandResult("SUCCESS", 0, "ok");
        }
    }
}
