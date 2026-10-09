package com.xy.aicodemother.ai.tools.model;

/**
 * 工程目录中的节点，path 始终相对于工程根目录，目录的 sizeBytes 为 0。
 */
public record ProjectFileNode(String path, String type, long sizeBytes) {
}
