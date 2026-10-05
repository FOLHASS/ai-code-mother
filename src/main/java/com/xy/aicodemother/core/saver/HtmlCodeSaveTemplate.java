package com.xy.aicodemother.core.saver;

import com.xy.aicodemother.ai.model.HtmlCodeResult;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;

public class HtmlCodeSaveTemplate extends AbstractCodeSaveTemplate<HtmlCodeResult>{
    @Override
    protected CodeGenTypeEnum getCodeType() {
        return CodeGenTypeEnum.HTML;
    }

    @Override
    protected void saveFiles(HtmlCodeResult result, String baseDirPath) {
        writeToFile(baseDirPath, "index.html", result.getHtmlCode());
    }
}
