package com.xy.aicodemother.ai.tools.model;

/** 预览发布结果，previewUrl 指向 dist 内容，不会暴露工程源码目录。 */
public record ProjectPreviewResult(boolean success, String previewUrl, String buildId, String message) {
}
