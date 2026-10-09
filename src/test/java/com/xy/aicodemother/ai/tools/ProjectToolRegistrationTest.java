package com.xy.aicodemother.ai.tools;

import cn.hutool.json.JSONUtil;
import com.xy.aicodemother.config.ProjectToolProperties;
import dev.langchain4j.agent.tool.ToolExecutionRequest;
import dev.langchain4j.agent.tool.ToolSpecifications;
import dev.langchain4j.service.tool.DefaultToolExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/** 验证真实 LangChain4j 工具定义及调用上下文，不依赖模型、数据库或 Redis。 */
class ProjectToolRegistrationTest {

    @TempDir
    Path tempDirectory;

    private ProjectFileTools fileTools;
    private ProjectBuildTools buildTools;

    @BeforeEach
    void setUp() throws Exception {
        ProjectToolProperties properties = new ProjectToolProperties();
        properties.setWorkspaceRoot(tempDirectory.resolve("source").toString());
        properties.setBuildRoot(tempDirectory.resolve("builds").toString());
        properties.setPreviewRoot(tempDirectory.resolve("previews").toString());
        ProjectWorkspace workspace = new ProjectWorkspace(properties);
        fileTools = new ProjectFileTools(workspace);
        buildTools = new ProjectBuildTools(new ProjectBuildService(workspace, properties,
                (directory, arguments, config) -> new ProjectCommandRunner.CommandResult("SUCCESS", 0, "")));
        Files.createDirectories(workspace.projectRoot(1L).resolve("src"));
        Files.writeString(workspace.projectRoot(1L).resolve("src/App.vue"), "app-one");
        Files.createDirectories(workspace.projectRoot(2L).resolve("src"));
        Files.writeString(workspace.projectRoot(2L).resolve("src/App.vue"), "app-two");
    }

    @Test
    void exposesAllToolsWithoutAllowingModelToSelectAppId() {
        var specifications = Stream.concat(ToolSpecifications.toolSpecificationsFrom(fileTools).stream(),
                ToolSpecifications.toolSpecificationsFrom(buildTools).stream()).toList();
        assertThat(specifications.stream().map(specification -> specification.name()).toList())
                .containsExactlyInAnyOrder("list_files", "read_file", "search_files", "create_file",
                        "update_file", "apply_patch", "delete_file", "type_check", "build_project", "publish_preview");
        for (var specification : specifications) {
            if (specification.parameters() != null) {
                assertThat(specification.parameters().properties()).doesNotContainKey("appId");
            }
        }
    }

    @Test
    void realToolExecutorInjectsAuthorizedAppContextAndSerializesRecord() throws Exception {
        var request = ToolExecutionRequest.builder().id("read-current-app").name("read_file")
                .arguments("{\"path\":\"src/App.vue\"}").build();
        var executor = new DefaultToolExecutor(fileTools,
                ProjectFileTools.class.getMethod("readFile", String.class, Long.class));
        var result = JSONUtil.parseObj(executor.execute(request, 1L));
        assertThat(result.getBool("success")).isTrue();
        assertThat(result.getJSONObject("data").getStr("content")).isEqualTo("app-one");
        assertThat(result.getJSONObject("data").getStr("sha256")).hasSize(64);
    }
}
