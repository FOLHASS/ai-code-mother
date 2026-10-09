package com.xy.aicodemother.ai.tools.model;

import java.util.List;

/**
 * 区分大小写的字面量搜索结果，truncated 表示存在未返回的命中或文件。
 */
public record ProjectSearchResult(List<ProjectSearchHit> matches, boolean truncated) {
}
