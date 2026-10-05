package com.xy.aicodemother.ai;

import com.xy.aicodemother.ai.model.HtmlCodeResult;
import com.xy.aicodemother.ai.model.MultiFileCodeResult;
import dev.langchain4j.service.Result;
import jakarta.annotation.Resource;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "RUN_LLM_TESTS", matches = "true")
class AiCodeGeneratorServiceTest {

    @Resource
    private AiCodeGeneratorService aiCodeGeneratorService;

    @Test
    void generateCode() {
       HtmlCodeResult result = aiCodeGeneratorService.generateHtmlCode("做个程序员鱼皮的博客");
        Assertions.assertNotNull(result);
    }

    @Test
    void generateMultiFileCode() {
        MultiFileCodeResult result = aiCodeGeneratorService.generateMultiFileCode("做个程序员鱼皮的留言板，不超过五行");
        Assertions.assertNotNull(result);
    }
}
