package com.xy.aicodemother.ai.tools.model;

/**
 * 检查或构建结果，模型可根据 status 和 logs 修复工程。
 * buildId 只代表本次快照，构建成功后还需要 publish_preview 才能展示。
 */
public record ProjectBuildResult(boolean success, String status, String buildId,
                                 String sourceFingerprint, String logs) {
}
