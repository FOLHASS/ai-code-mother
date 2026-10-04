package com.xy.aicodemother.core;

import com.xy.aicodemother.ai.model.HtmlCodeResult;
import com.xy.aicodemother.ai.model.MultiFileCodeResult;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 代码解析器。
 */
public final class CodeParser {

    /**
     * 单文件解析使用：
     * 结束标记必须独占一行，避免误截断代码中的反引号。
     */
    private static final Pattern HTML_CODE_PATTERN = Pattern.compile(
            "^```html[\\t ]*\\n([\\s\\S]*?)^```[\\t ]*$",
            Pattern.MULTILINE | Pattern.CASE_INSENSITIVE
    );

    private CodeParser() {
    }

    /**
     * 解析 HTML 单文件代码。
     * 支持 Markdown HTML 代码块，以及直接返回的 HTML。
     */
    public static HtmlCodeResult parseHtmlCode(String codeContent) {
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

    /**
     * 严格解析多文件输出。
     *
     * 固定顺序：
     * 1. ### index.html + html 代码块
     * 2. ### style.css + css 代码块
     * 3. ### script.js + javascript 代码块
     *
     * 允许区块之间以及整个输出首尾存在空行。
     * 文件标题与代码块开始标记之间不允许插入空行。
     *
     * @throws IllegalArgumentException 格式不符合要求
     */
    public static MultiFileCodeResult parseMultiFileCode(
            String codeContent) {

        Cursor cursor = new Cursor(normalize(codeContent));

        String htmlCode = cursor.readBlock("index.html", "html");
        String cssCode = cursor.readBlock("style.css", "css");
        String jsCode = cursor.readBlock("script.js", "javascript");

        cursor.skipBlankLines();

        if (cursor.hasNext()) {
            throw cursor.error("script.js 区块后存在额外内容");
        }

        validateHtml(htmlCode);

        MultiFileCodeResult result = new MultiFileCodeResult();
        result.setHtmlCode(htmlCode);
        result.setCssCode(cssCode);
        result.setJsCode(jsCode);
        return result;
    }

    /**
     * 统一换行符，并移除文本开头可能存在的 BOM。
     */
    private static String normalize(String content) {
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
    private static void validateHtml(String htmlCode) {
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

    /**
     * 逐行解析，避免跨文件匹配或将代码中的反引号误判为结束标记。
     */
    private static final class Cursor {

        private final List<String> lines;
        private int position;

        private Cursor(String content) {
            this.lines = List.of(content.split("\n", -1));
        }

        private String readBlock(String filename, String language) {
            skipBlankLines();

            // 严格检查文件标题
            expect("### " + filename);

            // 必须紧接指定语言的代码块开始标记
            expect("```" + language);

            int start = position;

            // 结束标记必须恰好为独占一行的三个反引号
            while (hasNext() && !lines.get(position).equals("```")) {
                position++;
            }

            if (!hasNext()) {
                throw error(filename + " 缺少结束标记 ```");
            }

            // 保留代码内部的缩进、空格和空行
            String code = String.join(
                    "\n",
                    lines.subList(start, position)
            );

            position++; // 跳过结束标记
            return code;
        }

        private void expect(String expected) {
            if (!hasNext()) {
                throw error("输出不完整，缺少：" + expected);
            }

            if (!lines.get(position).equals(expected)) {
                throw error("格式错误，此处必须为：" + expected);
            }

            position++;
        }

        private void skipBlankLines() {
            while (hasNext() && lines.get(position).isBlank()) {
                position++;
            }
        }

        private boolean hasNext() {
            return position < lines.size();
        }

        private IllegalArgumentException error(String message) {
            return new IllegalArgumentException(
                    message + "（第 " + (position + 1) + " 行）"
            );
        }
    }
}