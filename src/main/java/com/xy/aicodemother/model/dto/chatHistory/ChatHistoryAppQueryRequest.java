package com.xy.aicodemother.model.dto.chatHistory;

import com.xy.aicodemother.constant.ChatHistoryConstant;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 应用对话历史查询。首次不传游标；加载更早消息时传上批最后一条的时间和 id。
 */
@Data
public class ChatHistoryAppQueryRequest implements Serializable {

    private Long appId;

    /**
     * 默认 10 条，最多 10 条。
     */
    private int pageSize = ChatHistoryConstant.APP_HISTORY_PAGE_SIZE;

    /**
     * 上批最早一条消息的创建时间，必须和 lastId 一起传入。
     */
    private LocalDateTime lastCreateTime;

    private Long lastId;

    private static final long serialVersionUID = 1L;
}
