package com.xy.aicodemother.core.parser;

import com.xy.aicodemother.ai.model.HtmlCodeResult;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class HtmlCodeParseStrategy extends CodeParseStrategy<HtmlCodeResult>{

    /**
     * 单文件解析使用：
     * 结束标记必须独占一行，避免误截断代码中的反引号。
     */
    private static final Pattern HTML_CODE_PATTERN = Pattern.compile(
            "^```html[\\t ]*\\n([\\s\\S]*?)^```[\\t ]*$",
            Pattern.MULTILINE | Pattern.CASE_INSENSITIVE
    );

    @Override
    public boolean support(CodeGenTypeEnum codeGenTypeEnum) {
        return codeGenTypeEnum == CodeGenTypeEnum.HTML;
    }

    @Override
    public HtmlCodeResult parse(String content) {
        // 实现自己的解析算法
        return parseHtmlCode(content);
    }


    /**
     * 解析 HTML 单文件代码。
     * 支持 Markdown HTML 代码块，以及直接返回的 HTML。
     */
    private HtmlCodeResult parseHtmlCode(String codeContent) {
        String content = normalize(codeContent);

        Matcher matcher = HTML_CODE_PATTERN.matcher(content);
        String htmlCode = matcher.find()
                ? matcher.group(1).strip()
                : content.strip();

        validateHtml(htmlCode);

        HtmlCodeResult result = new HtmlCodeResult();
        result.setHtmlCode(htmlCode);
        return result;
    }
}
