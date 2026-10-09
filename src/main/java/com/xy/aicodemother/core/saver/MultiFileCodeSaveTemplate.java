package com.xy.aicodemother.core.saver;

import com.xy.aicodemother.ai.model.MultiFileCodeResult;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;

public class MultiFileCodeSaveTemplate extends AbstractCodeSaveTemplate<MultiFileCodeResult>{
    @Override
    protected String getCodeType() {
        return CodeGenTypeEnum.MULTI_FILE.getValue();
    }

    @Override
    protected void saveFiles(MultiFileCodeResult result, String baseDirPath) {
        // 避免单文件为空的时候影响保存整个流程
        writeToFile(baseDirPath, "index.html", result.getHtmlCode() != null ? result.getHtmlCode() : "");
        writeToFile(baseDirPath, "style.css", result.getCssCode() != null ? result.getCssCode() : "");
        writeToFile(baseDirPath, "script.js", result.getJsCode() != null ? result.getJsCode() : "");
    }
}
