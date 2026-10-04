package com.xy.aicodemother.core;


import com.xy.aicodemother.ai.AiCodeGeneratorService;
import com.xy.aicodemother.ai.model.HtmlCodeResult;
import com.xy.aicodemother.ai.model.MultiFileCodeResult;
import com.xy.aicodemother.exception.BusinessException;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.exception.ThrowUtils;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.io.File;

@Service
@Slf4j
public class AiCodeGeneratorFacade {
    @Resource
    private AiCodeGeneratorService aiCodeGeneratorService;

    public File generatorAndSaveCode(String userMessage, CodeGenTypeEnum codeGenTypeEnum){
        ThrowUtils.throwIf(codeGenTypeEnum == null, new IllegalArgumentException("代码生成类型不能为空"));
        return switch (codeGenTypeEnum) {

            case CodeGenTypeEnum.HTML -> generatorAndSaveHtmlCode(userMessage);

            case CodeGenTypeEnum.MULTI_FILE -> generatorAndSaveMultiFileCode(userMessage);

            default -> {
                throw new IllegalArgumentException("不支持的代码生成类型: " + codeGenTypeEnum);
            }
        };
    }

    // 流式输出代码
    public Flux<String> generatorAndSaveCodeStreaming(String userMessage, CodeGenTypeEnum codeGenTypeEnum){
        ThrowUtils.throwIf(codeGenTypeEnum == null, new IllegalArgumentException("代码生成类型不能为空"));
        return switch (codeGenTypeEnum) {

            case CodeGenTypeEnum.HTML -> generatorAndSaveHtmlCodeStreaming(userMessage);

            case CodeGenTypeEnum.MULTI_FILE -> generatorAndSaveMultiFileCodeStreaming(userMessage);

            default -> {
                throw new IllegalArgumentException("不支持的代码生成类型: " + codeGenTypeEnum);
            }
        };
    }



    private File generatorAndSaveHtmlCode(String userMessage) {
        HtmlCodeResult htmlCodeResult = aiCodeGeneratorService.generateCode(userMessage);
        return CodeFileSaver.saveHtmlCodeResult(htmlCodeResult);
    }

    private Flux<String> generatorAndSaveHtmlCodeStreaming(String userMessage) {
        Flux<String> result = aiCodeGeneratorService.generateCodeStreaming(userMessage);
        StringBuilder codeBuilder = new StringBuilder();
        return result.doOnNext(codeBuilder::append).doOnComplete(() -> {
            try{
                String completeCode = codeBuilder.toString();
                File resultFile = CodeFileSaver.saveHtmlCodeResult(CodeParser.parseHtmlCode(completeCode));
                log.info("代码已保存到文件：{}", resultFile.getAbsolutePath());
            }catch (Exception e){
                log.error("代码保存失败", e.getMessage());
            }
        });
    }

    private File generatorAndSaveMultiFileCode(String userMessage) {
        MultiFileCodeResult multiFileCodeResult = aiCodeGeneratorService.generateMultiFileCode(userMessage);
        return CodeFileSaver.saveMultiFileCodeResult(multiFileCodeResult);
    }

    private Flux<String> generatorAndSaveMultiFileCodeStreaming(String userMessage) {
        Flux<String> result = aiCodeGeneratorService.generateMultiFileCodeStreaming(userMessage);
        StringBuilder codeBuilder = new StringBuilder();
        return result.doOnNext(codeBuilder::append).doOnComplete(() -> {
            try{
                String completeCode = codeBuilder.toString();
                File resultFile = CodeFileSaver.saveMultiFileCodeResult(CodeParser.parseMultiFileCode(completeCode));
                log.info("代码已保存到文件：{}", resultFile.getAbsolutePath());
            }catch (Exception e){
                log.error("代码保存失败", e.getMessage());
            }
        });
    }
}
