package com.xy.aicodemother.ai.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/** AI 流式思考片段，与最终回复分开传递。 */
@EqualsAndHashCode(callSuper = true)
@Data
@NoArgsConstructor
public class AiThinkingMessage extends StreamMessage {

    private String data;

    public AiThinkingMessage(String data) {
        super(StreamMessageTypeEnum.AI_THINKING.getValue());
        this.data = data;
    }
}
