package com.xy.aicodemother.core.parser;

import com.xy.aicodemother.model.enums.CodeGenTypeEnum;

public abstract class CodeParseStrategy<T>{
    /**
     * 是否支持该类型
     * @param codeGenTypeEnum
     * @return
     */
    abstract boolean support(CodeGenTypeEnum codeGenTypeEnum);

    /**
     * 解析代码
     * @param content
     * @return
     */
    abstract T parse(String content);


    /**
     * 统一换行符，并移除文本开头可能存在的 BOM。
     */
    protected String normalize(String content) {
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("待解析内容不能为空");
        }

        String normalized = content
                .replace("\r\n", "\n")
                .replace('\r', '\n');

        if (normalized.startsWith("\uFEFF")) {
            normalized = normalized.substring(1);
        }

        return normalized;
    }

    /**
     * 检查 HTML 首尾标记，不执行 HTML 语法验证。
     */
    protected void validateHtml(String htmlCode) {
        if (!htmlCode.startsWith("<!DOCTYPE html>")) {
            throw new IllegalArgumentException(
                    "index.html 必须以 <!DOCTYPE html> 开始"
            );
        }

        if (!htmlCode.endsWith("</html>")) {
            throw new IllegalArgumentException(
                    "index.html 必须以 </html> 结束"
            );
        }
    }
}
