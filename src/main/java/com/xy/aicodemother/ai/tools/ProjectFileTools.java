package com.xy.aicodemother.ai.tools;

import com.xy.aicodemother.ai.tools.model.ProjectFileListing;
import com.xy.aicodemother.ai.tools.model.ProjectFileMutation;
import com.xy.aicodemother.ai.tools.model.ProjectFileNode;
import com.xy.aicodemother.ai.tools.model.ProjectFileSnapshot;
import com.xy.aicodemother.ai.tools.model.ProjectSearchHit;
import com.xy.aicodemother.ai.tools.model.ProjectSearchResult;
import com.xy.aicodemother.ai.tools.model.ProjectToolResult;
import dev.langchain4j.agent.tool.P;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.agent.tool.ToolMemoryId;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

/**
 * 编码 Agent 的文件工具。所有文件均位于服务端绑定的应用工作空间。
 *
 * <p>修改流程为 read_file 获取 sha256，再使用 update_file、apply_patch 或 delete_file。
 * 每次操作都在应用锁内完成路径校验、版本校验和修改。失败返回结构化结果供模型纠正，
 * 不把服务器绝对路径或底层异常泄露到模型上下文。</p>
 */
@Slf4j
@Component
public class ProjectFileTools {

    private static final int MAX_SEARCH_QUERY_LENGTH = 200;
    private static final int MAX_SEARCH_CONTEXT_LENGTH = 300;

    private final ProjectWorkspace workspace;

    public ProjectFileTools(ProjectWorkspace workspace) {
        this.workspace = workspace;
    }

    /**
     * 递归列出目录节点、源码和常见静态资源；大目录返回截断标记，可按子目录再次查询。
     *
     * @param directory 工程内相对目录，空值或 . 表示根目录
     * @param appId 来自服务端 ToolMemoryId 的应用 ID，不向模型暴露为工具参数
     */
    @Tool(name = "list_files", value = "递归读取当前工程目录，包含源码与图片、字体资源，排除依赖、构建目录、隐藏文件和凭证；返回相对路径。truncated=true 时请指定子目录缩小范围。")
    public ProjectToolResult<ProjectFileListing> listFiles(
            @P("工程相对目录，根目录使用 .") String directory,
            @ToolMemoryId Long appId) {
        ProjectToolResult<ProjectFileListing> result = execute(appId, () -> {
            Path root = workspace.projectRoot(appId);
            Path target = workspace.resolve(appId, directory, true);
            List<Path> entries = workspace.sourceEntries(appId, target);
            List<ProjectFileNode> nodes = new ArrayList<>();
            for (Path entry : entries.subList(0, Math.min(entries.size(), workspace.maxListEntries()))) {
                boolean isDirectory = Files.isDirectory(entry, LinkOption.NOFOLLOW_LINKS);
                nodes.add(new ProjectFileNode(ProjectWorkspace.relativePath(root, entry),
                        isDirectory ? "directory" : "file", isDirectory ? 0 : Files.size(entry)));
            }
            String relative = target.equals(root) ? "." : ProjectWorkspace.relativePath(root, target);
            return ProjectToolResult.success("工程目录读取成功", new ProjectFileListing(
                    relative, List.copyOf(nodes), entries.size() > nodes.size()));
        });
        if (result.success()) {
            log.info("工具 list_files 调用成功: appId={}, directory={}, entries={}, truncated={}",
                    appId, result.data().directory(), result.data().entries().size(), result.data().truncated());
        }
        return result;
    }

    /**
     * 读取 UTF-8 源码和 SHA-256。哈希是后续写入、精确替换和删除的必需版本凭证。
     */
    @Tool(name = "read_file", value = "读取当前工程的 UTF-8 源码文件，返回内容、字节数和 sha256。修改、替换或删除前必须先读取最新哈希。")
    public ProjectToolResult<ProjectFileSnapshot> readFile(
            @P("工程内源码文件的相对路径") String path,
            @ToolMemoryId Long appId) {
        ProjectToolResult<ProjectFileSnapshot> result = execute(appId, () -> ProjectToolResult.success("源码读取成功",
                workspace.readSnapshot(appId, workspace.resolve(appId, path, false))));
        if (result.success()) {
            log.info("工具 read_file 调用成功: appId={}, path={}, sizeBytes={}, sha256={}",
                    appId, result.data().path(), result.data().sizeBytes(), result.data().sha256());
        }
        return result;
    }

    /**
     * 搜索文案、组件和函数名。采用区分大小写的字面量匹配，不执行正则表达式。
     * 单行上下文和结果数均有限制；精确修改前仍需通过 read_file 读取完整文件。
     */
    @Tool(name = "search_files", value = "在当前工程源码中进行区分大小写的字面量搜索，返回文件相对路径、从 1 开始的行号和有限的单行上下文。不支持正则表达式。")
    public ProjectToolResult<ProjectSearchResult> searchFiles(
            @P("要搜索的文案、组件名或函数名，最多 200 个字符") String query,
            @ToolMemoryId Long appId) {
        ProjectToolResult<ProjectSearchResult> result = execute(appId, () -> {
            if (query == null || query.isBlank() || query.length() > MAX_SEARCH_QUERY_LENGTH
                    || query.indexOf('\n') >= 0 || query.indexOf('\r') >= 0) {
                throw new ProjectWorkspace.WorkspaceException("搜索内容不能为空，必须是最多 200 字符的单行文本");
            }
            List<ProjectSearchHit> hits = new ArrayList<>();
            boolean truncated = false;
            List<Path> entries = workspace.sourceEntries(appId, workspace.projectRoot(appId));
            int scannedFiles = 0;
            search:
            for (Path entry : entries) {
                if (!Files.isRegularFile(entry, LinkOption.NOFOLLOW_LINKS)
                        || !ProjectWorkspace.isTextSourceFile(entry)) {
                    continue;
                }
                if (++scannedFiles > workspace.maxListEntries()) {
                    truncated = true;
                    break;
                }
                ProjectFileSnapshot snapshot = workspace.readSnapshot(appId, entry);
                String[] lines = snapshot.content().split("\\R", -1);
                for (int index = 0; index < lines.length; index++) {
                    int matchIndex = lines[index].indexOf(query);
                    if (matchIndex < 0) {
                        continue;
                    }
                    if (hits.size() >= workspace.maxSearchResults()) {
                        truncated = true;
                        break search;
                    }
                    int start = Math.max(0, matchIndex - 50);
                    int end = Math.min(lines[index].length(), start + MAX_SEARCH_CONTEXT_LENGTH);
                    String context = (start > 0 ? "…" : "") + lines[index].substring(start, end)
                            + (end < lines[index].length() ? "…" : "");
                    hits.add(new ProjectSearchHit(snapshot.path(), index + 1, context));
                }
            }
            return ProjectToolResult.success("源码搜索完成",
                    new ProjectSearchResult(List.copyOf(hits), truncated));
        });
        if (result.success()) {
            log.info("工具 search_files 调用成功: appId={}, matches={}, truncated={}",
                    appId, result.data().matches().size(), result.data().truncated());
        }
        return result;
    }

    /**
     * 创建新的 UTF-8 源码文件，自动创建允许的父目录，严格禁止覆盖已有文件。
     */
    @Tool(name = "create_file", value = "在当前工程创建 UTF-8 源码文件并自动创建父目录。文件已存在时失败，绝不覆盖；已有文件必须 read_file 后使用 update_file。")
    public ProjectToolResult<ProjectFileMutation> createFile(
            @P("新源码文件的工程相对路径") String path,
            @P("完整 UTF-8 文件内容") String content,
            @ToolMemoryId Long appId) {
        ProjectToolResult<ProjectFileMutation> result = execute(appId, () -> {
            Path target = workspace.resolve(appId, path, false);
            byte[] bytes = workspace.encodeContent(content);
            workspace.writeFile(appId, target, bytes, true);
            return ProjectToolResult.success("源码文件创建成功", mutation(appId, target, bytes));
        });
        if (result.success()) {
            log.info("工具 create_file 调用成功: appId={}, path={}, sizeBytes={}, sha256={}",
                    appId, result.data().path(), result.data().sizeBytes(), result.data().sha256());
        }
        return result;
    }

    /**
     * 提供完整新内容来替换已有文件。期望哈希与当前文件不符时，拒绝覆盖。
     */
    @Tool(name = "update_file", value = "使用完整新内容原子更新已有 UTF-8 源码。expectedSha256 必须来自最近一次 read_file；版本不符时失败，请重新读取并重新修改。")
    public ProjectToolResult<ProjectFileMutation> updateFile(
            @P("要更新的源码文件相对路径") String path,
            @P("read_file 返回的当前文件 sha256") String expectedSha256,
            @P("更新后的完整 UTF-8 文件内容") String content,
            @ToolMemoryId Long appId) {
        ProjectToolResult<ProjectFileMutation> result = execute(appId, () -> {
            Path target = workspace.resolve(appId, path, false);
            requireCurrentVersion(appId, target, expectedSha256);
            byte[] bytes = workspace.encodeContent(content);
            workspace.writeFile(appId, target, bytes, false);
            return ProjectToolResult.success("源码文件更新成功", mutation(appId, target, bytes));
        });
        if (result.success()) {
            log.info("工具 update_file 调用成功: appId={}, path={}, sizeBytes={}, sha256={}",
                    appId, result.data().path(), result.data().sizeBytes(), result.data().sha256());
        }
        return result;
    }

    /**
     * 精确单次文本替换，而不是 unified diff 补丁。
     *
     * <p>oldText 必须非空，并且在原文件中恰好出现一次（包括重叠匹配）。
     * 空 newText 表示删除该片段。若片段找不到或出现多次，模型应读取文件，
     * 增加上下文后重新提交，不能猜测替换位置。</p>
     */
    @Tool(name = "apply_patch", value = "对 UTF-8 源码进行一次精确文本替换（不是 unified diff）。oldText 必须非空且在文件中只出现一次；newText 可为空。必须提供最近 read_file 的 expectedSha256。")
    public ProjectToolResult<ProjectFileMutation> applyPatch(
            @P("源码文件工程相对路径") String path,
            @P("read_file 返回的当前 sha256") String expectedSha256,
            @P("需替换的唯一原始片段，须包含足够上下文，不能是空字符串") String oldText,
            @P("替换后的新片段，空字符串表示删除片段") String newText,
            @ToolMemoryId Long appId) {
        ProjectToolResult<ProjectFileMutation> result = execute(appId, () -> {
            if (oldText == null || oldText.isEmpty() || newText == null) {
                throw new ProjectWorkspace.WorkspaceException("oldText 不能为空，newText 不能为 null");
            }
            workspace.encodeContent(oldText);
            workspace.encodeContent(newText);
            Path target = workspace.resolve(appId, path, false);
            ProjectFileSnapshot snapshot = requireCurrentVersion(appId, target, expectedSha256);
            int first = snapshot.content().indexOf(oldText);
            if (first < 0) {
                throw new ProjectWorkspace.WorkspaceException("原始片段不存在，请重新读取文件");
            }
            if (snapshot.content().indexOf(oldText, first + 1) >= 0) {
                throw new ProjectWorkspace.WorkspaceException("原始片段出现多次，请增加上下文以唯一定位");
            }
            String content = snapshot.content().substring(0, first) + newText
                    + snapshot.content().substring(first + oldText.length());
            byte[] bytes = workspace.encodeContent(content);
            workspace.writeFile(appId, target, bytes, false);
            return ProjectToolResult.success("源码片段替换成功", mutation(appId, target, bytes));
        });
        if (result.success()) {
            log.info("工具 apply_patch 调用成功: appId={}, path={}, sizeBytes={}, sha256={}",
                    appId, result.data().path(), result.data().sizeBytes(), result.data().sha256());
        }
        return result;
    }

    /**
     * 删除允许范围内的一个源码文件。校验哈希后删除，不支持删除目录或递归删除。
     */
    @Tool(name = "delete_file", value = "删除当前工程内的单个源码文件，禁止目录和递归删除。expectedSha256 必须是最近 read_file 返回的哈希，版本不符时拒绝删除。")
    public ProjectToolResult<ProjectFileMutation> deleteFile(
            @P("要删除的源码文件工程相对路径") String path,
            @P("read_file 返回的当前文件 sha256") String expectedSha256,
            @ToolMemoryId Long appId) {
        ProjectToolResult<ProjectFileMutation> result = execute(appId, () -> {
            Path target = workspace.resolve(appId, path, false);
            ProjectFileSnapshot snapshot = requireCurrentVersion(appId, target, expectedSha256);
            Files.delete(target);
            return ProjectToolResult.success("源码文件删除成功",
                    new ProjectFileMutation(snapshot.path(), null, 0));
        });
        if (result.success()) {
            log.info("工具 delete_file 调用成功: appId={}, path={}", appId, result.data().path());
        }
        return result;
    }

    private ProjectFileSnapshot requireCurrentVersion(Long appId, Path target, String expectedSha256)
            throws java.io.IOException {
        if (expectedSha256 == null || !expectedSha256.matches("[0-9a-fA-F]{64}")) {
            throw new ProjectWorkspace.WorkspaceException("必须提供 read_file 返回的有效 SHA-256");
        }
        ProjectFileSnapshot snapshot = workspace.readSnapshot(appId, target);
        if (!snapshot.sha256().equalsIgnoreCase(expectedSha256)) {
            throw new ProjectWorkspace.WorkspaceException("文件版本已变化，请重新 read_file 后再修改");
        }
        return snapshot;
    }

    private ProjectFileMutation mutation(Long appId, Path target, byte[] bytes) {
        return new ProjectFileMutation(ProjectWorkspace.relativePath(workspace.projectRoot(appId), target),
                ProjectWorkspace.sha256(bytes), bytes.length);
    }


    /**
     * 执行工程工具操作，自动加锁和异常转换
     * @param appId
     * @param operation
     * @return
     * @param <T>
     */
    private <T> ProjectToolResult<T> execute(Long appId, Callable<ProjectToolResult<T>> operation) {
        try {
            return workspace.withProjectLock(appId, operation);
        } catch (ProjectWorkspace.WorkspaceException e) {
            return ProjectToolResult.failure(e.getMessage());
        } catch (RuntimeException e) {
            return ProjectToolResult.failure("工程工具执行失败，请检查相对路径及工程状态");
        }
    }
}
