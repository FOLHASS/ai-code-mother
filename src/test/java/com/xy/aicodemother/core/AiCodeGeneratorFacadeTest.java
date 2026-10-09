package com.xy.aicodemother.core;

import com.xy.aicodemother.model.enums.CodeGenTypeEnum;
import jakarta.annotation.Resource;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import reactor.core.publisher.Flux;

import java.io.File;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "RUN_LLM_TESTS", matches = "true")
class AiCodeGeneratorFacadeTest {
    @Resource
    private AiCodeGeneratorFacade aiCodeGeneratorFacade;

    @Test
    void generatorAndSaveCode() {
        File file = aiCodeGeneratorFacade.generateAndSaveCode("帮我生成一份简历 控制在100kToken范围内", CodeGenTypeEnum.MULTI_FILE, 1L);
        Assertions.assertNotNull(file);
    }

    @Test
    void generatorAndSaveCodeStreaming() {
        Flux<String> flux = aiCodeGeneratorFacade.generateAndSaveCodeStream("帮我生成一份简历 总代码量不超过十行", CodeGenTypeEnum.HTML, 1L);
        List<String> stringList = flux.collectList().block();
        Assertions.assertNotNull(stringList);
    }

    @Test
    void generateVueProjectCodeStream() {
        Flux<String> codeStream = aiCodeGeneratorFacade.generateAndSaveCodeStream(
                "简单的任务记录网站, 不超过2000行代码",
                CodeGenTypeEnum.VUE_PROJECT, 6L);
        // 阻塞等待所有数据收集完成
        List<String> result = codeStream.collectList().block();
        // 验证结果
        Assertions.assertNotNull(result);
        String completeContent = String.join("", result);
        Assertions.assertNotNull(completeContent);
    }

}
