package com.xy.aicodemother.service;

import com.mybatisflex.core.paginate.Page;
import com.mybatisflex.core.query.QueryWrapper;
import com.mybatisflex.core.service.IService;
import com.xy.aicodemother.model.dto.chatHistory.ChatHistoryAppQueryRequest;
import com.xy.aicodemother.model.dto.chatHistory.ChatHistoryQueryRequest;
import com.xy.aicodemother.model.entity.ChatHistory;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.model.vo.ChatHistoryVO;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;

/**
 * 对话历史 服务层。
 *
 * @author yel
 * @since 2026-10-06
 */
public interface ChatHistoryService extends IService<ChatHistory> {

    /**
     * 内部写入入口：校验应用存在、消息类型以及对话发起者归属。
     */
    boolean addChatHistory(Long appId, String message, String messageType, Long userId);

    int loadChatHistoryToMemory(long appId, MessageWindowChatMemory chatMemory, int maxCount);

    /**
     * 创建者或管理员查询应用历史，默认每批最新 10 条。
     */
    Page<ChatHistoryVO> listAppChatHistoryByPage(ChatHistoryAppQueryRequest queryRequest, User loginUser);

    /**
     * 管理员查看全部应用的历史，按时间和 id 降序。
     */
    Page<ChatHistoryVO> adminListChatHistoryByPage(ChatHistoryQueryRequest queryRequest, User loginUser);

    /**
     * 删除应用时关联清理历史；没有历史时同样视为成功。
     */
    boolean deleteByAppId(Long appId);

    QueryWrapper getQueryWrapper(ChatHistoryQueryRequest queryRequest);

    ChatHistoryVO getChatHistoryVO(ChatHistory chatHistory);
}
