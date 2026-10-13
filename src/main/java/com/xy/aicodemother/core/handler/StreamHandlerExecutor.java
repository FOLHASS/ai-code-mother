package com.xy.aicodemother.core.handler;

import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;
import com.xy.aicodemother.service.ChatHistoryService;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

/**
 * 流处理器执行器
 * 所有代码生成类型统一使用 JSON 消息流处理器，正文、思考过程与工具事件一并透传：
 * HTML、MULTI_FILE、VUE_PROJECT -> JsonMessageStreamHandler
 */
@Slf4j
@Component
public class StreamHandlerExecutor {

    @Resource
    private JsonMessageStreamHandler jsonMessageStreamHandler;

    /**
     * 创建流处理器并处理聊天历史记录
     *
     * @param originFlux         原始流
     * @param chatHistoryService 聊天历史服务
     * @param appId              应用ID
     * @param loginUser          登录用户
     * @param codeGenType        代码生成类型
     * @return 处理后的流
     */
    public Flux<String> doExecute(Flux<String> originFlux,
                                  ChatHistoryService chatHistoryService,
                                  long appId, User loginUser, CodeGenTypeEnum codeGenType) {
        return switch (codeGenType) {
            // 三种类型统一使用 JSON 消息流处理器，思考过程与正文、工具事件一并透传。
            case VUE_PROJECT, HTML, MULTI_FILE ->
                    jsonMessageStreamHandler.handle(originFlux, chatHistoryService, appId, loginUser, codeGenType);
        };
    }
}
