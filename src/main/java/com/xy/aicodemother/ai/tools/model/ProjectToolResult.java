package com.xy.aicodemother.ai.tools.model;

/**
 * 工程工具的统一返回值。失败信息可直接提供给模型，数据中不包含服务器绝对路径。
 *
 * @param success 本次操作是否成功
 * @param message 操作说明或可供模型纠正请求的错误信息
 * @param data 操作结果；失败时为空
 */
public record ProjectToolResult<T>(boolean success, String message, T data) {

    public static <T> ProjectToolResult<T> success(String message, T data) {
        return new ProjectToolResult<>(true, message, data);
    }

    public static <T> ProjectToolResult<T> failure(String message) {
        return new ProjectToolResult<>(false, message, null);
    }
}
