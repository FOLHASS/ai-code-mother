package com.xy.aicodemother.ai;

import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.service.AiServices;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;



@Configuration
public class AiCodeGeneratorServiceFactory {
    @Resource
    private ChatModel chatModel;

    /**
     * 创建AI代码生成器服务
     * @return
     */
    @Bean
    AiCodeGeneratorService aiCodeGeneratorService() {
        // 也可以指定流式输出的模型


        return AiServices.create(AiCodeGeneratorService.class, chatModel);
    }
}
