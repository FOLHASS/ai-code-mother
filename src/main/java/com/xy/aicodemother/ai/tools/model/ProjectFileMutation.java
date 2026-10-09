package com.xy.aicodemother.ai.tools.model;

/**
 * 文件修改结果；删除成功时 sha256 为空，sizeBytes 为 0。
 */
public record ProjectFileMutation(String path, String sha256, long sizeBytes) {
}
