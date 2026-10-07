package com.xy.aicodemother.service.impl;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.StrUtil;
import com.mybatisflex.core.paginate.Page;
import com.mybatisflex.core.query.QueryWrapper;
import com.mybatisflex.spring.service.impl.ServiceImpl;
import com.xy.aicodemother.constant.ChatHistoryConstant;
import com.xy.aicodemother.constant.UserConstant;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.exception.ThrowUtils;
import com.xy.aicodemother.mapper.AppMapper;
import com.xy.aicodemother.mapper.ChatHistoryMapper;
import com.xy.aicodemother.model.dto.chatHistory.ChatHistoryAppQueryRequest;
import com.xy.aicodemother.model.dto.chatHistory.ChatHistoryQueryRequest;
import com.xy.aicodemother.model.entity.App;
import com.xy.aicodemother.model.entity.ChatHistory;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.model.enums.ChatHistoryMessageTypeEnum;
import com.xy.aicodemother.model.vo.ChatHistoryVO;
import com.xy.aicodemother.service.ChatHistoryService;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import jakarta.annotation.Resource;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 对话历史服务，集中处理归属校验、消息持久化和分页规则。
 */
@Service
public class ChatHistoryServiceImpl extends ServiceImpl<ChatHistoryMapper, ChatHistory> implements ChatHistoryService {

    // 直接使用 Mapper 查询应用，避免与 AppService 形成循环依赖。
    @Resource
    private AppMapper appMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean addChatHistory(Long appId, String message, String messageType, Long userId) {
        validateId(appId, "应用 id 不合法");
        validateId(userId, "用户 id 不合法");
        ThrowUtils.throwIf(StrUtil.isBlank(message), ErrorCode.PARAMS_ERROR, "消息不能为空");
        ThrowUtils.throwIf(ChatHistoryMessageTypeEnum.getEnumByValue(messageType) == null,
                ErrorCode.PARAMS_ERROR, "消息类型不合法");

        // 与应用删除使用同一行锁，避免生成结束后为已删除的应用重新写入历史。
        App app = appMapper.selectOneByQuery(QueryWrapper.create().eq("id", appId).forUpdate());
        ThrowUtils.throwIf(app == null, ErrorCode.NOT_FOUND_ERROR, "应用不存在");
        ThrowUtils.throwIf(!userId.equals(app.getUserId()), ErrorCode.NO_AUTH_ERROR, "无权在该应用下保存消息");

        ChatHistory chatHistory = new ChatHistory();
        chatHistory.setAppId(appId);
        chatHistory.setUserId(userId);
        chatHistory.setMessage(message);
        chatHistory.setMessageType(messageType);
        boolean result = save(chatHistory);
        ThrowUtils.throwIf(!result, ErrorCode.OPERATION_ERROR, "对话历史保存失败");
        return true;
    }

    @Override
    public int loadChatHistoryToMemory(long appId, MessageWindowChatMemory chatMemory, int maxCount) {
        QueryWrapper queryWrapper = QueryWrapper.create()
                .eq(ChatHistory::getAppId, appId)
                .orderBy(ChatHistory::getCreateTime, false)
                // 注意从1开始加载数据 因为在执行到这里的时候 已经将用户的第一条消息存入store中了
                .limit(1, maxCount);

        List<ChatHistory> chatHistories = list(queryWrapper);
        if(CollUtil.isEmpty(chatHistories)) {
            return 0;
        }

        chatHistories = chatHistories.reversed();
        chatMemory.clear();
        int count = 0;
        for(ChatHistory chatHistory : chatHistories) {
            if(ChatHistoryMessageTypeEnum.AI.getValue().equals(chatHistory.getMessageType())) {
                chatMemory.add(new AiMessage(chatHistory.getMessage()));
            }else if(ChatHistoryMessageTypeEnum.USER.getValue().equals(chatHistory.getMessageType())){
                chatMemory.add(new UserMessage(chatHistory.getMessage()));
            }
            count ++;
        }
        return count;

    }

    @Override
    public Page<ChatHistoryVO> listAppChatHistoryByPage(ChatHistoryAppQueryRequest queryRequest, User loginUser) {
        // 1. 校验参数
        Long userId = getLoginUserId(loginUser);
        ThrowUtils.throwIf(queryRequest == null, ErrorCode.PARAMS_ERROR, "请求参数为空");
        validateId(queryRequest.getAppId(), "应用 id 不合法");
        ThrowUtils.throwIf(queryRequest.getPageSize() <= 0
                        || queryRequest.getPageSize() > ChatHistoryConstant.APP_HISTORY_PAGE_SIZE,
                ErrorCode.PARAMS_ERROR, "每次最多加载 10 条消息");

        boolean hasTime = queryRequest.getLastCreateTime() != null;
        boolean hasId = queryRequest.getLastId() != null;
        ThrowUtils.throwIf(hasTime != hasId, ErrorCode.PARAMS_ERROR, "游标时间和消息 id 必须一起传入");
        if (hasId) {
            validateId(queryRequest.getLastId(), "游标消息 id 不合法");
        }

        App app = appMapper.selectOneById(queryRequest.getAppId());
        ThrowUtils.throwIf(app == null, ErrorCode.NOT_FOUND_ERROR, "应用不存在");
        ThrowUtils.throwIf(!userId.equals(app.getUserId())
                        && !UserConstant.ADMIN_ROLE.equals(loginUser.getUserRole()),
                ErrorCode.NO_AUTH_ERROR, "仅应用创建者和管理员可查看对话历史");

        QueryWrapper queryWrapper = QueryWrapper.create().eq("appId", queryRequest.getAppId());
        if (hasTime) {
            // 其实这一步不会出现时间相同的消息，但为了保险起见，还是保留这一步
            // 时间相同的消息再比较 id，避免 DATETIME 秒级精度导致历史漏读。
            queryWrapper.and((QueryWrapper cursor) -> {
                cursor.lt("createTime", queryRequest.getLastCreateTime())
                        .or((QueryWrapper sameTime) -> {
                            sameTime.eq("createTime", queryRequest.getLastCreateTime())
                                    .lt("id", queryRequest.getLastId());
                        });
            });
        }
        queryWrapper.orderBy("createTime", false).orderBy("id", false);
        return toVOPage(page(Page.of(1, queryRequest.getPageSize()), queryWrapper));
    }

    @Override
    public Page<ChatHistoryVO> adminListChatHistoryByPage(ChatHistoryQueryRequest queryRequest, User loginUser) {
        getLoginUserId(loginUser);
        ThrowUtils.throwIf(!UserConstant.ADMIN_ROLE.equals(loginUser.getUserRole()),
                ErrorCode.NO_AUTH_ERROR, "仅管理员可查看全部对话历史");
        ThrowUtils.throwIf(queryRequest == null, ErrorCode.PARAMS_ERROR, "请求参数为空");
        ThrowUtils.throwIf(queryRequest.getPageNum() <= 0 || queryRequest.getPageSize() <= 0,
                ErrorCode.PARAMS_ERROR, "分页参数不合法");
        return toVOPage(page(Page.of(queryRequest.getPageNum(), queryRequest.getPageSize()),
                getQueryWrapper(queryRequest)));
    }

    @Override
    public boolean deleteByAppId(Long appId) {
        validateId(appId, "应用 id 不合法");
        // 按项目约定逻辑删除；零条历史不影响应用删除，SQL 执行异常则由事务回滚。
        getMapper().deleteByQuery(QueryWrapper.create().eq("appId", appId));
        return true;
    }

    @Override
    public QueryWrapper getQueryWrapper(ChatHistoryQueryRequest queryRequest) {
        ThrowUtils.throwIf(queryRequest == null, ErrorCode.PARAMS_ERROR, "请求参数为空");
        if (queryRequest.getId() != null) validateId(queryRequest.getId(), "消息 id 不合法");
        if (queryRequest.getAppId() != null) validateId(queryRequest.getAppId(), "应用 id 不合法");
        if (queryRequest.getUserId() != null) validateId(queryRequest.getUserId(), "用户 id 不合法");
        String messageType = StrUtil.trimToNull(queryRequest.getMessageType());
        ThrowUtils.throwIf(messageType != null && ChatHistoryMessageTypeEnum.getEnumByValue(messageType) == null,
                ErrorCode.PARAMS_ERROR, "消息类型不合法");
        return QueryWrapper.create()
                .eq("id", queryRequest.getId())
                .eq("appId", queryRequest.getAppId())
                .eq("userId", queryRequest.getUserId())
                .eq("messageType", messageType)
                .like("message", StrUtil.trimToNull(queryRequest.getMessage()))
                .orderBy("createTime", false)
                .orderBy("id", false);
    }

    @Override
    public ChatHistoryVO getChatHistoryVO(ChatHistory chatHistory) {
        if (chatHistory == null) return null;
        ChatHistoryVO vo = new ChatHistoryVO();
        BeanUtils.copyProperties(chatHistory, vo);
        return vo;
    }

    private Page<ChatHistoryVO> toVOPage(Page<ChatHistory> page) {
        Page<ChatHistoryVO> voPage = new Page<>(page.getPageNumber(), page.getPageSize(), page.getTotalRow());
        voPage.setRecords(page.getRecords().stream().map(this::getChatHistoryVO).toList());
        return voPage;
    }

    private Long getLoginUserId(User loginUser) {
        ThrowUtils.throwIf(loginUser == null || loginUser.getId() == null,
                ErrorCode.NOT_LOGIN_ERROR, "用户未登录");
        return loginUser.getId();
    }

    private void validateId(Long id, String message) {
        ThrowUtils.throwIf(id == null || id <= 0, ErrorCode.PARAMS_ERROR, message);
    }
}
