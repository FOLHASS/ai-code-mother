package com.xy.aicodemother.core;


import com.xy.aicodemother.ai.AiCodeGeneratorService;
import com.xy.aicodemother.ai.AiCodeGeneratorServiceFactory;
import com.xy.aicodemother.ai.model.HtmlCodeResult;
import com.xy.aicodemother.ai.model.MultiFileCodeResult;
import com.xy.aicodemother.core.parser.CodeParseStrategyContext;
import com.xy.aicodemother.core.saver.CodeFileSaverExecutor;
import com.xy.aicodemother.exception.BusinessException;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.exception.ThrowUtils;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.io.File;

@Service
@Slf4j
public class AiCodeGeneratorFacade {
    @Resource
    private AiCodeGeneratorServiceFactory aiCodeGeneratorServiceFactory;

    /**
     * 统一入口：根据类型生成并保存代码
     *
     * @param userMessage     用户提示词
     * @param codeGenTypeEnum 生成类型
     * @return 保存的目录
     */
    public File generateAndSaveCode(String userMessage, CodeGenTypeEnum codeGenTypeEnum, long appId) {
        ThrowUtils.throwIf(codeGenTypeEnum == null, ErrorCode.SYSTEM_ERROR, "生成类型为空");

        AiCodeGeneratorService aiCodeGeneratorService = aiCodeGeneratorServiceFactory.getAiCodeGeneratorService(appId);
        return switch (codeGenTypeEnum) {
            case HTML -> {
                HtmlCodeResult result = aiCodeGeneratorService.generateHtmlCode(userMessage);
                yield CodeFileSaverExecutor.executeSaver(result, CodeGenTypeEnum.HTML, appId);
            }
            case MULTI_FILE -> {
                MultiFileCodeResult result = aiCodeGeneratorService.generateMultiFileCode(userMessage);
                yield CodeFileSaverExecutor.executeSaver(result, CodeGenTypeEnum.MULTI_FILE, appId);
            }
            default -> {
                String errorMessage = "不支持的生成类型：" + codeGenTypeEnum.getValue();
                throw new BusinessException(ErrorCode.SYSTEM_ERROR, errorMessage);
            }
        };
    }

    /**
     * 统一入口：根据类型生成并保存代码（流式）
     *
     * @param userMessage     用户提示词
     * @param codeGenTypeEnum 生成类型
     */
    public Flux<String> generateAndSaveCodeStream(String userMessage, CodeGenTypeEnum codeGenTypeEnum, Long appId) {
        ThrowUtils.throwIf(codeGenTypeEnum == null, ErrorCode.SYSTEM_ERROR, "生成类型为空");

        // 根据工厂为每一个App去创建一个AI服务
        AiCodeGeneratorService aiCodeGeneratorService = aiCodeGeneratorServiceFactory.getAiCodeGeneratorService(appId);

        return switch (codeGenTypeEnum) {
            case HTML -> {
                Flux<String> codeStream = aiCodeGeneratorService.generateCodeStream(userMessage);
                yield processCodeStream(codeStream, CodeGenTypeEnum.HTML, appId);
            }
            case MULTI_FILE -> {
                Flux<String> codeStream = aiCodeGeneratorService.generateMultiFileCodeStream(userMessage);
                yield processCodeStream(codeStream, CodeGenTypeEnum.MULTI_FILE, appId);
            }
            default -> {
                String errorMessage = "不支持的生成类型：" + codeGenTypeEnum.getValue();
                throw new BusinessException(ErrorCode.SYSTEM_ERROR, errorMessage);
            }
        };
    }


    /**
     * 通用流式代码处理方法
     *
     * @param codeStream  代码流
     * @param codeGenType 代码生成类型
     * @return 流式响应
     */
    private Flux<String> processCodeStream(Flux<String> codeStream, CodeGenTypeEnum codeGenType, long appId) {
        StringBuilder codeBuilder = new StringBuilder();
        java.util.concurrent.atomic.AtomicInteger chunkIndex = new java.util.concurrent.atomic.AtomicInteger();
        // 实时收集代码片段
        return codeStream
                .doOnNext(chunk -> {
                    int index = chunkIndex.incrementAndGet();
                    log.info("AI stream chunk #{}: length={}, appId={}", index, chunk.length(), appId);
                    codeBuilder.append(chunk);
                })
                .concatWith(Mono.defer(() -> {
                    try {
                        String completeCode = codeBuilder.toString();
                        Object parsedResult = CodeParseStrategyContext.parser(completeCode, codeGenType);
                        File savedDir = CodeFileSaverExecutor.executeSaver(parsedResult, codeGenType, appId);
                        log.info("保存成功，路径为：{}", savedDir.getAbsolutePath());
                        return Mono.empty();
                    } catch (Exception e) {
                        log.error("保存失败: {}", e.getMessage(), e);
                        return Mono.error(e);
                    }
                }));
    }

}
