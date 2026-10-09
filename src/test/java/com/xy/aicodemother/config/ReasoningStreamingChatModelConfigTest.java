package com.xy.aicodemother.config;

import dev.langchain4j.model.chat.StreamingChatModel;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class ReasoningStreamingChatModelConfigTest {

    @Test
    void createsModelAndBindsPropertiesWithoutCallingExternalServices() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(ConfigurationPropertiesAutoConfiguration.class))
                .withUserConfiguration(ReasoningStreamingChatModelConfig.class)
                .withPropertyValues(
                        "langchain4j.open-ai.chat-model.api-key=test-api-key",
                        "langchain4j.open-ai.chat-model.base-url=http://127.0.0.1:1/v1")
                .run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(StreamingChatModel.class);
                    ReasoningStreamingChatModelConfig config = context.getBean(ReasoningStreamingChatModelConfig.class);
                    assertThat(config.getApiKey()).isEqualTo("test-api-key");
                    assertThat(config.getBaseUrl()).isEqualTo("http://127.0.0.1:1/v1");
                });
    }
}
