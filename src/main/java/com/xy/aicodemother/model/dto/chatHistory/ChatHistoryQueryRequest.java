package com.xy.aicodemother.model.dto.chatHistory;

import com.xy.aicodemother.common.PageRequest;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serializable;

/**
 * 管理员对话历史分页查询。服务端固定按创建时间、id 降序排列。
 */
@EqualsAndHashCode(callSuper = true)
@Data
public class ChatHistoryQueryRequest extends PageRequest implements Serializable {

    private Long id;
    private Long appId;
    private Long userId;
    private String messageType;

    /**
     * 消息内容，支持模糊查询。
     */
    private String message;

    private static final long serialVersionUID = 1L;
}
