package com.xy.aicodemother.ai;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.xy.aicodemother.ai.tools.ProjectBuildTools;
import com.xy.aicodemother.ai.tools.ProjectFileTools;
import com.xy.aicodemother.exception.BusinessException;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;
import com.xy.aicodemother.service.ChatHistoryService;
import dev.langchain4j.community.store.memory.chat.redis.RedisChatMemoryStore;
import dev.langchain4j.data.message.ToolExecutionResultMessage;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.service.AiServices;
import dev.langchain4j.service.TokenStream;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;


@Slf4j
@Configuration
public class AiCodeGeneratorServiceFactory {
    @Resource
    private ChatModel chatModel;

    @Resource
    private StreamingChatModel openAiStreamingChatModel;

    @Resource
    private RedisChatMemoryStore redisChatMemoryStore;

    @Resource
    private ChatHistoryService chatHistoryService;

    @Resource
    private StreamingChatModel reasoningStreamingChatModel;

    /** 文件工具通过 @ToolMemoryId 使用当前应用 id，模型不能选择其他应用的目录。 */
    @Resource
    private ProjectFileTools projectFileTools;

    /** 固定的检查、构建及预览发布工具，不向模型开放任意终端命令。 */
    @Resource
    private ProjectBuildTools projectBuildTools;

    /**
     * AI 服务实例缓存
     * 缓存策略：
     * - 最大缓存 1000 个实例
     * - 写入后 30 分钟过期
     * - 访问后 10 分钟过期
     */
    private final Cache<String, AiCodeGeneratorService> serviceCache = Caffeine.newBuilder().maximumSize(1000).expireAfterWrite(Duration.ofMinutes(30)).expireAfterAccess(Duration.ofMinutes(10)).removalListener((key, value, cause) -> {
        log.debug("AI 服务实例被移除，缓存键: {}, 原因: {}", key, cause);
    }).build();

    /**
     * 根据 appId 获取服务（带缓存）  兼容旧代码
     */
    public AiCodeGeneratorService getAiCodeGeneratorService(long appId) {
        return getAiCodeGeneratorService(appId, CodeGenTypeEnum.HTML);
    }

    /**
     * 根据 appId 获取服务（带缓存）
     */
    public AiCodeGeneratorService getAiCodeGeneratorService(long appId, CodeGenTypeEnum codeGenTypeEnum) {
        if (codeGenTypeEnum == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "代码生成类型不能为空");
        }
        String cacheKey = buildCacheKey(appId, codeGenTypeEnum.getValue());
        return serviceCache.get(cacheKey, k -> createAiCodeGeneratorService(appId, codeGenTypeEnum));
    }

    /**
     * 创建新的 AI 服务实例
     */
    private AiCodeGeneratorService createAiCodeGeneratorService(long appId, CodeGenTypeEnum codeGenTypeEnum) {
        log.info("为 appId: {} 创建新的 AI 服务实例", appId);
        // 根据 appId 构建独立的对话记忆
        MessageWindowChatMemory chatMemory = MessageWindowChatMemory.builder().id(appId).chatMemoryStore(redisChatMemoryStore).maxMessages(20).build();
        chatHistoryService.loadChatHistoryToMemory(appId, chatMemory, 20);

        return switch (codeGenTypeEnum) {
            case HTML, MULTI_FILE -> AiServices.builder(AiCodeGeneratorService.class)
                    .chatModel(chatModel)
                    .streamingChatModel(openAiStreamingChatModel)
                    .chatMemory(chatMemory)
                    .build();
            case VUE_PROJECT -> AiServices.builder(AiCodeGeneratorService.class)
                    .chatModel(chatModel)
                    .streamingChatModel(reasoningStreamingChatModel)
                    .chatMemoryProvider(memoryId -> chatMemory)
//                    .tools(projectFileTools, projectBuildTools)
                    .tools(projectFileTools)        // 暂时不用本地构建
                    // 处理工具调用幻觉问题
                    .hallucinatedToolNameStrategy(toolExecutionRequest ->
                            ToolExecutionResultMessage.from(toolExecutionRequest,
                                    "Error: there is no tool with name '" + toolExecutionRequest.name()))

                    .build();
            default -> throw new BusinessException(ErrorCode.SYSTEM_ERROR, "Invalid code gen type");
        };
    }


    /**
     * 创建AI代码生成器服务
     *
     * @return
     */
    @Bean
    AiCodeGeneratorService aiCodeGeneratorService() {
        return getAiCodeGeneratorService(0);
    }


    /**
     * 构造缓存键
     * @param appId
     * @param codeGenType
     * @return
     */
    private String buildCacheKey(long appId, String codeGenType) {
        return appId + "_" + codeGenType;
    }
}
