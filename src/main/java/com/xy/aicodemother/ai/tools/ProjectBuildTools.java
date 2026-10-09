package com.xy.aicodemother.ai.tools;

import com.xy.aicodemother.ai.tools.model.ProjectBuildResult;
import com.xy.aicodemother.ai.tools.model.ProjectPreviewResult;
import com.xy.aicodemother.exception.BusinessException;
import dev.langchain4j.agent.tool.P;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.agent.tool.ToolMemoryId;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 向 AI 暴露工程类型检查、构建和发布能力。
 *
 * <p>appId 由 @ToolMemoryId 注入，模型不能指定其他应用；模型也不能传入任意命令、
 * 端口、工作目录或预览地址。工具成功结果和失败日志可直接用于下一轮修复。</p>
 */
@Component
@Slf4j
public class ProjectBuildTools {

    private final ProjectBuildService buildService;

    public ProjectBuildTools(ProjectBuildService buildService) {
        this.buildService = buildService;
    }

    /** 调用已有的 type-check/typecheck 脚本，缺少脚本时返回明确配置错误。 */
    @Tool(name = "type_check", value = "对当前工程创建源码快照并执行 type-check 或 typecheck 脚本。返回检查状态和错误日志，不修改源码也不发布预览。")
    public ProjectBuildResult typeCheck(@ToolMemoryId Long appId) {
        try {
            ProjectBuildResult result = buildService.typeCheck(appId);
            if (result.success()) {
                log.info("工具 type_check 调用成功: appId={}, status={}, sourceFingerprint={}",
                        appId, result.status(), result.sourceFingerprint());
            }
            return result;
        } catch (ProjectWorkspace.WorkspaceException | BusinessException e) {
            return new ProjectBuildResult(false, "VALIDATION_FAILED", null, null, e.getMessage());
        }
    }

    /** 构建成功后返回 buildId；源码再被修改时该构建不能发布。 */
    @Tool(name = "build_project", value = "在隔离源码快照中安装依赖并执行固定 build 脚本，校验 dist/index.html，返回 buildId 和有界错误日志。只有 success=true 才可调用 publish_preview。")
    public ProjectBuildResult buildProject(@ToolMemoryId Long appId) {
        try {
            ProjectBuildResult result = buildService.buildProject(appId);
            if (result.success()) {
                log.info("工具 build_project 调用成功: appId={}, status={}, buildId={}, sourceFingerprint={}",
                        appId, result.status(), result.buildId(), result.sourceFingerprint());
            }
            return result;
        } catch (ProjectWorkspace.WorkspaceException | BusinessException e) {
            return new ProjectBuildResult(false, "VALIDATION_FAILED", null, null, e.getMessage());
        }
    }

    /** 发布当前应用对应的成功构建，返回前端 iframe 可展示的网站地址。 */
    @Tool(name = "publish_preview", value = "发布当前应用最近一次成功且源码未变化的构建产物。返回预览 URL；必须传入 build_project 成功返回的 buildId。失败不会覆盖上一版预览。")
    public ProjectPreviewResult publishPreview(
            @P("build_project 成功返回的 buildId") String buildId,
            @ToolMemoryId Long appId) {
        try {
            ProjectPreviewResult result = buildService.publishPreview(appId, buildId);
            if (result.success()) {
                log.info("工具 publish_preview 调用成功: appId={}, buildId={}, previewUrl={}",
                        appId, result.buildId(), result.previewUrl());
            }
            return result;
        } catch (ProjectWorkspace.WorkspaceException | BusinessException e) {
            return new ProjectPreviewResult(false, null, buildId, e.getMessage());
        }
    }
}
