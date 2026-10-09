package com.xy.aicodemother.ai;

import com.xy.aicodemother.ai.model.HtmlCodeResult;
import com.xy.aicodemother.ai.model.MultiFileCodeResult;
import dev.langchain4j.service.*;
import reactor.core.publisher.Flux;


public interface AiCodeGeneratorService {

    /**
     * 根据用户输入生成HTML代码
     * @param userMessage
     * @return
     */
    @SystemMessage(fromResource = "prompt/codegen-html-system-prompt.txt")
    HtmlCodeResult generateHtmlCode(String userMessage);

    /**
     * 根据用户输入生成多文件代码
     * @param userMessage
     * @return
     */
    @SystemMessage(fromResource = "prompt/codegen-multi-file-system-prompt.txt")
    MultiFileCodeResult generateMultiFileCode(String userMessage);

    /**
     * 根据用户输入生成HTML代码
     * @param userMessage
     * @return
     */
    @SystemMessage(fromResource = "prompt/codegen-html-system-prompt.txt")
    Flux<String> generateCodeStream(String userMessage);

    /**
     * 根据用户输入生成多文件代码
     * @param userMessage
     * @return
     */
    @SystemMessage(fromResource = "prompt/codegen-multi-file-system-prompt.txt")
    Flux<String>  generateMultiFileCodeStream(String userMessage);


    /**
     * 生成Vue代码 -- 流式输出
     * @param userMessage
     * @return
     */
    @SystemMessage(fromResource = "prompt/codegen-vue-project-system-prompt.txt")
    Flux<String>  generateVueProjectCodeStream(@MemoryId Long appId, @UserMessage String userMessage);
}
