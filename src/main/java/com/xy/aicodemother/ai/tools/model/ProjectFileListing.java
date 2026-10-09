package com.xy.aicodemother.ai.tools.model;

import java.util.List;

/**
 * 递归目录清单。truncated 为 true 时可指定更深层的 directory 再次查询。
 */
public record ProjectFileListing(String directory, List<ProjectFileNode> entries, boolean truncated) {
}
