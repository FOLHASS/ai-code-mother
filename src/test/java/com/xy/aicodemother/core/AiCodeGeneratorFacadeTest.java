package com.xy.aicodemother.core;

import com.xy.aicodemother.model.enums.CodeGenTypeEnum;
import jakarta.annotation.Resource;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import reactor.core.publisher.Flux;

import java.io.File;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class AiCodeGeneratorFacadeTest {
    @Resource
    private AiCodeGeneratorFacade aiCodeGeneratorFacade;

    @Test
    void generatorAndSaveCode() {
        File file = aiCodeGeneratorFacade.generateAndSaveCode("帮我生成一份简历 控制在100kToken范围内", CodeGenTypeEnum.MULTI_FILE);
        Assertions.assertNotNull(file);
    }

    @Test
    void generatorAndSaveCodeStreaming() {
        Flux<String> flux = aiCodeGeneratorFacade.generateAndSaveCodeStream("帮我生成一份简历 总代码量不超过十行", CodeGenTypeEnum.HTML);
        List<String> stringList = flux.collectList().block();
        Assertions.assertNotNull(stringList);
    }
}