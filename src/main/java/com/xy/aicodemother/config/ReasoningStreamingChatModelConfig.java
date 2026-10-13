package com.xy.aicodemother.config;

import dev.langchain4j.http.client.spring.restclient.SpringRestClient;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.model.openai.OpenAiStreamingChatModel;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
@ConfigurationProperties(prefix = "langchain4j.open-ai.chat-model")
@Data
public class ReasoningStreamingChatModelConfig {
    private String baseUrl;

    private String apiKey;

    private String modelName;

    private String timeout;

    /**
     * 提供带推理能力的流式模型（用于Vue项目的生成和工具的调用）
     * @return
     */
    @Bean
    public StreamingChatModel reasoningStreamingChatModel() {
        final int maxTokens = 64768;
        return OpenAiStreamingChatModel.builder()
                // 明确使用 Spring HTTP 客户端，避免与 JDK 客户端的 SPI 自动发现冲突。
                .httpClientBuilder(SpringRestClient.builder())
                .apiKey(apiKey)
                .baseUrl(baseUrl)
                .modelName(modelName)
                .logRequests(false)
                .logResponses(false)
                .timeout(Duration.ofSeconds(600))
                .reasoningEffort("low")
                .returnThinking(true)
                .build();
    }

}
