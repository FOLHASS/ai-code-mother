package com.xy.aicodemother.ai.tools.model;

/**
 * 文本搜索命中，lineNumber 从 1 开始，line 为经过长度限制的单行上下文。
 */
public record ProjectSearchHit(String path, int lineNumber, String line) {
}
