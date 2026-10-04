package com.xy.aicodemother.core;


import com.xy.aicodemother.ai.AiCodeGeneratorService;
import com.xy.aicodemother.ai.model.HtmlCodeResult;
import com.xy.aicodemother.ai.model.MultiFileCodeResult;
import com.xy.aicodemother.exception.ThrowUtils;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

import java.io.File;

@Service
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

    private File generatorAndSaveHtmlCode(String userMessage) {
        HtmlCodeResult htmlCodeResult = aiCodeGeneratorService.generateCode(userMessage);
        return CodeFileSaver.saveHtmlCodeResult(htmlCodeResult);
    }

    private File generatorAndSaveMultiFileCode(String userMessage) {
        MultiFileCodeResult multiFileCodeResult = aiCodeGeneratorService.generateMultiFileCode(userMessage);
        return CodeFileSaver.saveMultiFileCodeResult(multiFileCodeResult);
    }
}
