package com.xy.aicodemother.core.parser;

import com.xy.aicodemother.ai.model.HtmlCodeResult;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class HtmlCodeParseStrategy extends CodeParseStrategy<HtmlCodeResult>{
    private static final Pattern HTML_CODE_PATTERN = Pattern.compile("```html\\s*\\n([\\s\\S]*?)```", Pattern.CASE_INSENSITIVE);

    @Override
    public boolean support(CodeGenTypeEnum codeGenTypeEnum) {
        return codeGenTypeEnum == CodeGenTypeEnum.HTML;
    }

    @Override
    public HtmlCodeResult parse(String content) {
        // 实现自己的解析算法
        return parseHtmlCode(content);
    }

    public HtmlCodeResult parseHtmlCode(String codeContent) {
        HtmlCodeResult result = new HtmlCodeResult();
        // 提取 HTML 代码
        String htmlCode = extractHtmlCode(codeContent);
        if (htmlCode != null && !htmlCode.trim().isEmpty()) {
            result.setHtmlCode(htmlCode.trim());
        } else {
            // 如果没有找到代码块，将整个内容作为HTML
            result.setHtmlCode(codeContent.trim());
        }
        return result;
    }

    /**
     * 提取HTML代码内容
     *
     * @param content 原始内容
     * @return HTML代码
     */
    private String extractHtmlCode(String content) {
        Matcher matcher = HTML_CODE_PATTERN.matcher(content);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }
}

