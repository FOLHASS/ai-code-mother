package com.xy.aicodemother.ai.model;

import lombok.EqualsAndHashCode;
import lombok.Getter;

/**
 * 模型思考过程消息（reasoning content）。
 * <p>思考内容与正文分开传递，前端可据此流式展示模型的推理过程。</p>
 */
@Getter
@EqualsAndHashCode(callSuper = true)
public class ThinkingMessage extends StreamMessage {

    /** 本次思考片段内容。 */
    private final String content;

    public ThinkingMessage(String content) {
        super(StreamMessageTypeEnum.THINKING.getValue());
        this.content = content;
    }
}
