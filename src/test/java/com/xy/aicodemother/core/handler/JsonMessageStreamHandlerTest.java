package com.xy.aicodemother.core.handler;

import cn.hutool.json.JSONUtil;
import com.xy.aicodemother.ai.model.StreamMessageTypeEnum;
import com.xy.aicodemother.ai.model.ToolExecutedMessage;
import com.xy.aicodemother.ai.tools.ProjectFileTools;
import com.xy.aicodemother.ai.tools.ProjectWorkspace;
import com.xy.aicodemother.config.ProjectToolProperties;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.model.enums.ChatHistoryMessageTypeEnum;
import com.xy.aicodemother.service.ChatHistoryService;
import dev.langchain4j.internal.Json;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import reactor.core.publisher.Flux;

import java.lang.reflect.Proxy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** 使用真实文件工具的结构化返回值验证展示，不调用 AI、数据库或真实构建。 */
class JsonMessageStreamHandlerTest {

    private static final long APP_ID = 3L;
    private static final long USER_ID = 9L;

    @TempDir
    Path temporaryDirectory;

    private ProjectFileTools tools;
    private ProjectWorkspace workspace;

    @BeforeEach
    void setUp() {
        ProjectToolProperties properties = new ProjectToolProperties();
        properties.setWorkspaceRoot(temporaryDirectory.resolve("sources").toString());
        workspace = new ProjectWorkspace(properties);
        tools = new ProjectFileTools(workspace);
    }

    @Test
    void listsDirectoriesAndFilesInsteadOfShowingAWriteOperation() {
        assertTrue(tools.createFile("src/App.vue", "<template>任务</template>", APP_ID).success());
        String output = display("list_files", Map.of("directory", "."), tools.listFiles(".", APP_ID));

        assertTrue(output.contains("目录读取完成"));
        assertTrue(output.contains("src"));
        assertTrue(output.contains("src/App.vue"));
        assertFalse(output.contains("写入文件"));
    }

    @Test
    void readsActualReturnedContentInsteadOfArgumentsContent() {
        String source = "<template>读取到的内容</template>";
        assertTrue(tools.createFile("src/App.vue", source, APP_ID).success());
        String output = display("read_file", Map.of("path", "src/App.vue"),
                tools.readFile("src/App.vue", APP_ID));

        assertTrue(output.contains("文件读取完成"));
        assertTrue(output.contains("src/App.vue"));
        assertTrue(output.contains(source));
        assertTrue(output.contains("```html"));
    }

    @Test
    void searchesShowKeywordFileLineAndMatchedText() {
        assertTrue(tools.createFile("src/App.vue", "<template>\n任务列表\n</template>", APP_ID).success());
        String output = display("search_files", Map.of("query", "任务"), tools.searchFiles("任务", APP_ID));

        assertTrue(output.contains("搜索完成"));
        assertTrue(output.contains("任务"));
        assertTrue(output.contains("src/App.vue"));
        assertTrue(output.contains("任务列表"));
        assertTrue(output.contains("src/App.vue:2"));
    }

    @Test
    void createsAndUpdatesShowTheSuccessfullySubmittedSource() {
        String path = "src/main.ts";
        String original = "export const title = '旧标题';";
        String created = display("create_file", Map.of("path", path, "content", original),
                tools.createFile(path, original, APP_ID));
        assertTrue(created.contains("文件创建完成"));
        assertTrue(created.contains(path));
        assertTrue(created.contains(original));

        String hash = tools.readFile(path, APP_ID).data().sha256();
        String updatedSource = "export const title = '新标题';";
        String updated = display("update_file", Map.of("path", path, "expectedSha256", hash,
                "content", updatedSource), tools.updateFile(path, hash, updatedSource, APP_ID));
        assertTrue(updated.contains("文件更新完成"));
        assertTrue(updated.contains(path));
        assertTrue(updated.contains(updatedSource));
        assertFalse(updated.contains(original));
    }

    @Test
    void patchesShowTheOriginalAndReplacementSnippetIncludingDeletion() {
        String path = "src/main.ts";
        String original = "export const title = '旧标题';";
        assertTrue(tools.createFile(path, original, APP_ID).success());
        String hash = tools.readFile(path, APP_ID).data().sha256();
        String output = display("apply_patch", Map.of("path", path, "oldText", "旧标题", "newText", "新标题"),
                tools.applyPatch(path, hash, "旧标题", "新标题", APP_ID));
        assertTrue(output.contains("文件修改完成"));
        assertTrue(output.contains(path));
        assertTrue(output.contains("旧标题"));
        assertTrue(output.contains("新标题"));

        hash = tools.readFile(path, APP_ID).data().sha256();
        String deletedSnippet = display("apply_patch", Map.of("path", path, "oldText", "新标题", "newText", ""),
                tools.applyPatch(path, hash, "新标题", "", APP_ID));
        assertTrue(deletedSnippet.contains("删除"));
        assertFalse(deletedSnippet.contains("null"));
    }

    @Test
    void deletionShowsThePathWithoutInventingAContentPreview() {
        String path = "src/main.ts";
        assertTrue(tools.createFile(path, "export {}", APP_ID).success());
        String hash = tools.readFile(path, APP_ID).data().sha256();
        String output = display("delete_file", Map.of("path", path), tools.deleteFile(path, hash, APP_ID));

        assertTrue(output.contains("文件删除完成"));
        assertTrue(output.contains(path));
        assertFalse(output.contains("```"));
        assertFalse(output.contains("null"));
    }

    @Test
    void failedMutationsShowFailureAndDoNotDisplayTheRejectedContent() {
        String path = "src/main.ts";
        assertTrue(tools.createFile(path, "export {}", APP_ID).success());
        String rejected = "export const mustNotBeDisplayed = '内容未写入';";
        String output = display("create_file", Map.of("path", path, "content", rejected),
                tools.createFile(path, rejected, APP_ID));

        assertTrue(output.contains("工具执行失败"));
        assertTrue(output.contains("已存在"));
        assertFalse(output.contains("文件创建完成"));
        assertFalse(output.contains(rejected));
        assertFalse(output.contains("```"));
    }

    @Test
    void emptyDirectoriesAndSearchResultsRemainInformative() throws Exception {
        Files.createDirectories(workspace.projectRoot(APP_ID));
        String listing = display("list_files", Map.of("directory", "."), tools.listFiles(".", APP_ID));
        String search = display("search_files", Map.of("query", "不存在的文案"),
                tools.searchFiles("不存在的文案", APP_ID));

        assertTrue(listing.contains("目录读取完成"));
        assertTrue(listing.contains("空") || listing.contains("没有") || listing.contains("暂无"));
        assertTrue(search.contains("搜索完成"));
        assertTrue(search.contains("未找到") || search.contains("没有") || search.contains("暂无"));
        assertFalse(listing.contains("null"));
        assertFalse(search.contains("null"));
    }

    @Test
    void largeListsAndSearchResultsAreBoundedWithTruncationExplanation() {
        for (int index = 0; index < 25; index++) {
            assertTrue(tools.createFile("file%02d.ts".formatted(index), "needle", APP_ID).success());
        }
        String listing = display("list_files", Map.of("directory", "."), tools.listFiles(".", APP_ID));
        String search = display("search_files", Map.of("query", "needle"), tools.searchFiles("needle", APP_ID));

        for (String output : List.of(listing, search)) {
            assertTrue(output.contains("file00.ts"));
            assertFalse(output.contains("file24.ts"));
            assertTrue(output.contains("file19.ts"));
            assertFalse(output.contains("file20.ts"));
            assertTrue(output.contains("截断") || output.contains("更多") || output.contains("仅展示"));
        }
    }

    @Test
    void longContentIsBoundedAndEmbeddedMarkdownCannotCloseTheOuterCodeFence() {
        String source = "```js\nconst escaped = 'markdown';\n```\n" + "x".repeat(9_000) + "NOT_DISPLAYED_TAIL";
        assertTrue(tools.createFile("README.md", source, APP_ID).success());
        String output = display("read_file", Map.of("path", "README.md"), tools.readFile("README.md", APP_ID));

        assertTrue(output.contains("````markdown") || output.contains("````md"));
        assertTrue(output.contains("```js\nconst escaped = 'markdown';\n```"));
        assertFalse(output.contains("NOT_DISPLAYED_TAIL"));
        assertTrue(output.length() < source.length());
        assertTrue(output.contains("截断") || output.contains("省略") || output.contains("仅展示"));
        assertTrue(output.lastIndexOf("````") > output.indexOf("```js"));
    }

    @Test
    void unknownToolsAndUnstructuredResultsUseANeutralFallback() {
        for (String result : List.of("工程已处理", "{invalid json", "")) {
            String output = displayRaw("unknown_tool", "not-json", result);
            assertTrue(output.contains("工具执行结果"));
            assertFalse(output.contains("成功"));
            assertFalse(output.contains("null"));
        }
        String output = displayRaw("read_file", "{}", "普通文本结果");
        assertTrue(output.contains("工具执行结果"));
        assertTrue(output.contains("普通文本结果"));
        assertFalse(output.contains("文件读取完成"));
    }

    private String display(String toolName, Map<String, ?> arguments, Object result) {
        return displayRaw(toolName, JSONUtil.toJsonStr(arguments), Json.toJson(result));
    }

    private String displayRaw(String toolName, String arguments, String result) {
        ToolExecutedMessage message = new ToolExecutedMessage();
        message.setType(StreamMessageTypeEnum.TOOL_EXECUTED.getValue());
        message.setId("tool-call-1");
        message.setName(toolName);
        message.setArguments(arguments);
        message.setResult(result);

        List<String> savedHistory = new ArrayList<>();
        ChatHistoryService historyService = (ChatHistoryService) Proxy.newProxyInstance(
                ChatHistoryService.class.getClassLoader(), new Class<?>[]{ChatHistoryService.class},
                (proxy, method, values) -> {
                    assertEquals("addChatHistory", method.getName());
                    assertEquals(APP_ID, values[0]);
                    assertEquals(ChatHistoryMessageTypeEnum.AI.getValue(), values[2]);
                    assertEquals(USER_ID, values[3]);
                    savedHistory.add((String) values[1]);
                    return true;
                });
        User user = new User();
        user.setId(USER_ID);
        List<String> output = new JsonMessageStreamHandler().handle(
                        Flux.just(JSONUtil.toJsonStr(message)), historyService, APP_ID, user)
                .collectList().block(Duration.ofSeconds(5));
        assertNotNull(output);
        assertEquals(1, output.size());
        assertEquals(List.of(output.getFirst()), savedHistory,
                "工具展示内容应与保存的对话历史一致");
        return output.getFirst();
    }
}
