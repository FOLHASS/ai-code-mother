package com.xy.aicodemother.ai.model;

import lombok.Getter;

/** 工具即将执行时的调用消息，前端可据此展示执行中状态。 */
@Getter
public final class ToolRequestMessage extends StreamMessage {

    /** 本次调用的 ID，与完成消息关联，同名工具可调用多次。 */
    private final String toolId;

    /** 工具名称，例如 read_file、create_file。 */
    private final String toolName;

    /** 工具调用时的完整 JSON 参数。 */
    private final String toolArguments;

    public ToolRequestMessage(String toolId, String toolName, String toolArguments) {
        super(StreamMessageTypeEnum.TOOL_REQUEST.getValue());
        this.toolId = toolId;
        this.toolName = toolName;
        this.toolArguments = toolArguments;
    }
}
