package com.xy.aicodemother.ai.tools.model;

/**
 * UTF-8 文件快照。修改或删除前必须提交这里返回的 sha256，以防覆盖较新的文件。
 */
public record ProjectFileSnapshot(String path, String content, String sha256, long sizeBytes) {
}
