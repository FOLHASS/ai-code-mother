package com.xy.aicodemother.core;


import cn.hutool.json.JSONUtil;
import com.xy.aicodemother.ai.AiCodeGeneratorService;
import com.xy.aicodemother.ai.AiCodeGeneratorServiceFactory;
import com.xy.aicodemother.ai.model.*;
import com.xy.aicodemother.ai.tools.ProjectBuildService;
import com.xy.aicodemother.core.parser.CodeParseStrategyContext;
import com.xy.aicodemother.core.saver.CodeFileSaverExecutor;
import com.xy.aicodemother.exception.BusinessException;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.exception.ThrowUtils;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;
import dev.langchain4j.service.TokenStream;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.io.File;

@Service
@Slf4j
public class AiCodeGeneratorFacade {
    @Resource
    private AiCodeGeneratorServiceFactory aiCodeGeneratorServiceFactory;

    @Resource
    private ProjectBuildService projectBuildService;

    /**
     * 统一入口：根据类型生成并保存代码
     *
     * @param userMessage     用户提示词
     * @param codeGenTypeEnum 生成类型
     * @return 保存的目录
     */
    public File generateAndSaveCode(String userMessage, CodeGenTypeEnum codeGenTypeEnum, long appId) {
        ThrowUtils.throwIf(codeGenTypeEnum == null, ErrorCode.SYSTEM_ERROR, "生成类型为空");

        AiCodeGeneratorService aiCodeGeneratorService = aiCodeGeneratorServiceFactory.getAiCodeGeneratorService(appId, codeGenTypeEnum);
        return switch (codeGenTypeEnum) {
            case HTML -> {
                HtmlCodeResult result = aiCodeGeneratorService.generateHtmlCode(userMessage);
                yield CodeFileSaverExecutor.executeSaver(result, CodeGenTypeEnum.HTML, appId);
            }
            case MULTI_FILE -> {
                MultiFileCodeResult result = aiCodeGeneratorService.generateMultiFileCode(userMessage);
                yield CodeFileSaverExecutor.executeSaver(result, CodeGenTypeEnum.MULTI_FILE, appId);
            }
            default -> {
                String errorMessage = "不支持的生成类型：" + codeGenTypeEnum.getValue();
                throw new BusinessException(ErrorCode.SYSTEM_ERROR, errorMessage);
            }
        };
    }

    /**
     * 统一入口：根据类型生成并保存代码（流式）
     *
     * @param userMessage     用户提示词
     * @param codeGenTypeEnum 生成类型
     */
    public Flux<String> generateAndSaveCodeStream(String userMessage, CodeGenTypeEnum codeGenTypeEnum, Long appId) {
        // 保留纯文本入口供原有调用方使用，工具展示消息只通过新的消息流入口输出。
        return generateAndSaveCodeMessageStream(userMessage, codeGenTypeEnum, appId).ofType(AiResponseMessage.class).map(AiResponseMessage::getData);
    }

    /**
     * 生成并保存代码，同时输出 AI 文字、工具调用和工具完成三类消息。
     * 工具事件不进入源码解析；保存、构建和发布完成后消息流才结束。
     */
    public Flux<String> generateAndSaveCodeMessageStream(String userMessage, CodeGenTypeEnum codeGenTypeEnum, Long appId) {
        ThrowUtils.throwIf(codeGenTypeEnum == null, ErrorCode.SYSTEM_ERROR, "生成类型为空");

        return Flux.defer(() -> {
            // 根据工厂为每一个 App 创建 AI 服务。
            AiCodeGeneratorService aiCodeGeneratorService = aiCodeGeneratorServiceFactory.getAiCodeGeneratorService(appId, codeGenTypeEnum);

            return switch (codeGenTypeEnum) {
                case HTML -> processCodeStream(
                        aiCodeGeneratorService.generateCodeStream(userMessage), CodeGenTypeEnum.HTML, appId);
                case MULTI_FILE -> processCodeStream(
                        aiCodeGeneratorService.generateMultiFileCodeStream(userMessage), CodeGenTypeEnum.MULTI_FILE, appId);
                case VUE_PROJECT -> toFlux(aiCodeGeneratorService.generateVueProjectCodeStream(appId, userMessage));
                default -> {
                    String errorMessage = "不支持的生成类型：" + codeGenTypeEnum.getValue();
                    throw new BusinessException(ErrorCode.SYSTEM_ERROR, errorMessage);
                }
            };
        });
    }


    /**
     * 上层 Flux.defer 为每次订阅创建独立 TokenStream，此处在订阅时注册回调并启动。
     * 错误回调只能注册一次，不能同时使用 onError 和 ignoreErrors。
     * 工具结果按原文透传，包括工具返回的失败信息；只有最终 AI 回复完成才结束 Flux。
     * 传递结构化的封包信息，方便下游解析和处理
     */
    public static Flux<String> toFlux(TokenStream tokenStream) {
        return Flux.create(sink -> {
            tokenStream.onPartialThinking(thinking -> {
                        ThinkingMessage thinkingMessage = new ThinkingMessage(thinking.text());
                        sink.next(JSONUtil.toJsonStr(thinkingMessage));
                    }).onPartialResponse(content -> {
                        AiResponseMessage aiResponseMessage = new AiResponseMessage(content);
                        sink.next(JSONUtil.toJsonStr(aiResponseMessage));
                    }).onPartialToolCall(before -> {
                        ToolRequestMessage toolRequestMessage = new ToolRequestMessage(before.id(), before.name(), before.partialArguments());
                        sink.next(JSONUtil.toJsonStr(toolRequestMessage));
                    }).onToolExecuted(execution -> {
                        ToolExecutedMessage toolExecutedMessage = new ToolExecutedMessage(execution);
                        sink.next(JSONUtil.toJsonStr(toolExecutedMessage));
                    }).onCompleteResponse(response -> sink.complete())
                    .onError(sink::error)
                    .start();
        });
    }


    /**
     * 通用流式代码处理方法。
     * <p>将 TokenStream 转成消息流透传给前端，同时从中提取 AI 正文，待流结束后解析并保存代码。</p>
     *
     * @param tokenStream 模型流式响应的 TokenStream
     * @param codeGenType 代码生成类型
     * @return 流式响应
     */
    private Flux<String> processCodeStream(TokenStream tokenStream, CodeGenTypeEnum codeGenType, long appId) {
        StringBuilder codeBuilder = new StringBuilder();
        // 将 TokenStream 转为消息流，正文、思考、工具事件全部透传给前端。
        Flux<String> messageStream = toFlux(tokenStream);
        // 实时收集 AI 正文片段；思考与工具事件不进入源码解析。
        return messageStream
                .doOnNext(messageJson -> {
                    AiResponseMessage aiResponse = parseAiResponse(messageJson);
                    if (aiResponse != null && aiResponse.getData() != null) {
                        codeBuilder.append(aiResponse.getData());
                    }
                })
                .concatWith(Mono.defer(() -> {
                    try {
                        String completeCode = codeBuilder.toString();
                        Object parsedResult = CodeParseStrategyContext.parser(completeCode, codeGenType);
                        File savedDir = CodeFileSaverExecutor.executeSaver(parsedResult, codeGenType, appId);
                        log.info("保存成功，路径为：{}", savedDir.getAbsolutePath());
                        return Mono.empty();
                    } catch (Exception e) {
                        log.error("保存失败: {}", e.getMessage(), e);
                        return Mono.error(e);
                    }
                }));
    }

    /**
     * 从消息流 JSON 中解析 AI 正文消息，非正文消息返回 null。
     */
    private AiResponseMessage parseAiResponse(String messageJson) {
        try {
            String type = JSONUtil.parseObj(messageJson).getStr("type");
            if (StreamMessageTypeEnum.AI_RESPONSE.getValue().equals(type)) {
                return JSONUtil.toBean(messageJson, AiResponseMessage.class);
            }
            return null;
        } catch (Exception e) {
            log.warn("解析流式消息失败: {}", messageJson, e);
            return null;
        }
    }

}
