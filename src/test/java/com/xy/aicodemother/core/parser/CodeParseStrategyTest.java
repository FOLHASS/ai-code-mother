package com.xy.aicodemother.core.parser;

import com.xy.aicodemother.ai.model.HtmlCodeResult;
import com.xy.aicodemother.ai.model.MultiFileCodeResult;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CodeParseStrategyTest {

    private static final String HTML = "<!DOCTYPE html>\n<html><body></body></html>";

    @Test
    void parsesMultiFileOutputWithBlankLinesAndCaseDifferences() {
        String content = "\uFEFF  \n"
                + "### index.html\n\n```HTML\n" + HTML + "\n```\n\n"
                + "### style.css\n\n```CSS\nbody { color: red; }\n```\n"
                + "### script.js\n```JavaScript\nconsole.log('ok');\n```\n";

        MultiFileCodeResult result = new MultiFileCodeParseStrategy().parseMultiFileCode(content);

        assertEquals(HTML, result.getHtmlCode());
        assertEquals("body { color: red; }", result.getCssCode());
        assertEquals("console.log('ok');", result.getJsCode());
    }

    @Test
    void parsesHtmlWithMarkdownFence() {
        String content = "```html\n" + HTML + "\n```";

        HtmlCodeResult result = new HtmlCodeParseStrategy().parse(content);

        assertEquals(HTML, result.getHtmlCode());
    }

    @Test
    void rejectsMissingMultiFileBlock() {
        String content = "### index.html\n```html\n" + HTML + "\n```\n"
                + "### style.css\n```css\nbody {}\n```\n";

        assertThrows(IllegalArgumentException.class,
                () -> new MultiFileCodeParseStrategy().parseMultiFileCode(content));
    }
}
