package com.xy.aicodemother.core;

import cn.hutool.json.JSONUtil;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.model.chat.request.ChatRequest;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.model.chat.response.PartialThinking;
import dev.langchain4j.model.chat.response.StreamingChatResponseHandler;
import dev.langchain4j.service.AiServices;
import dev.langchain4j.service.IllegalConfigurationException;
import dev.langchain4j.service.TokenStream;
import org.junit.jupiter.api.Test;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/** 使用真实 AiServiceTokenStream 校验回调注册规则，不请求 AI 或依赖动态代理模拟 TokenStream。 */
class TokenStreamErrorHandlingTest {

    @Test
    void registersErrorHandlerOnceAndStreamsAiResponse() {
        StubStreamingModel model = new StubStreamingModel(true);
        Flux<String> messages = AiCodeGeneratorFacade.toFlux(createStream(model));
        assertNull(model.handler, "订阅前不应启动模型调用");

        List<String> result = messages.collectList().block(Duration.ofSeconds(5));

        assertNotNull(result);
        assertEquals(2, result.size());
        assertEquals(List.of("准备生成", "生成完毕"), result.stream()
                .map(message -> JSONUtil.parseObj(message).getStr("data")).toList());
        assertTrue(result.stream().allMatch(message ->
                "ai_response".equals(JSONUtil.parseObj(message).getStr("type"))));
        assertNotNull(model.handler);
    }

    @Test
    void streamsThinkingSeparatelyFromAiResponse() {
        StubStreamingModel model = new StubStreamingModel(true, true);

        List<String> result = AiCodeGeneratorFacade.toFlux(createStream(model))
                .collectList().block(Duration.ofSeconds(5));

        assertNotNull(result);
        assertEquals(3, result.size());
        assertEquals("ai_thinking", JSONUtil.parseObj(result.getFirst()).getStr("type"));
        assertEquals("先规划工程", JSONUtil.parseObj(result.getFirst()).getStr("data"));
        assertEquals("ai_response", JSONUtil.parseObj(result.get(1)).getStr("type"));
        assertEquals("准备生成", JSONUtil.parseObj(result.get(1)).getStr("data"));
    }

    @Test
    void forwardsModelErrorAfterSubscriptionWithoutCompleting() {
        StubStreamingModel model = new StubStreamingModel(false);
        List<String> messages = new ArrayList<>();
        AtomicReference<Throwable> error = new AtomicReference<>();
        AtomicBoolean complete = new AtomicBoolean();
        Disposable subscription = AiCodeGeneratorFacade.toFlux(createStream(model))
                .subscribe(messages::add, error::set, () -> complete.set(true));
        try {
            assertNotNull(model.handler);
            assertNull(error.get());
            RuntimeException failure = new RuntimeException("模型流中断");

            // 模型返回后再触发回调，覆盖请求启动与异步流错误两个不同阶段。
            model.handler.onPartialResponse("处理中");
            model.handler.onError(failure);

            assertEquals(1, messages.size());
            assertEquals("处理中", JSONUtil.parseObj(messages.getFirst()).getStr("data"));
            assertSame(failure, error.get());
            assertFalse(complete.get());
        } finally {
            subscription.dispose();
        }
    }

    @Test
    void exposesSynchronousStartValidationFailureAsFluxError() {
        StubStreamingModel model = new StubStreamingModel(true);
        TokenStream stream = createStream(model);
        // 模拟已配置错误回调的 TokenStream；适配器再注册一次后由真实 SDK 拒绝启动。
        stream.onError(ignored -> fail("配置校验异常应通过 Flux 传播"));
        AtomicReference<Throwable> error = new AtomicReference<>();
        AtomicBoolean complete = new AtomicBoolean();

        assertDoesNotThrow(() -> AiCodeGeneratorFacade.toFlux(stream)
                .subscribe(ignored -> fail("配置失败不应产生消息"), error::set, () -> complete.set(true)));

        IllegalConfigurationException failure = assertInstanceOf(IllegalConfigurationException.class, error.get());
        assertTrue(failure.getMessage().contains("[onError, ignoreErrors]"));
        assertTrue(failure.getMessage().contains("exactly 1 time"));
        assertNull(model.handler, "配置失败时不应向模型发送请求");
        assertFalse(complete.get());
    }

    private TokenStream createStream(StreamingChatModel model) {
        return AiServices.builder(TestChatService.class).streamingChatModel(model).build().chat("生成任务网站");
    }

    public interface TestChatService {
        TokenStream chat(String userMessage);
    }

    /** 仅替代模型传输层，保留 LangChain4j 的真实回调注册和启动校验。 */
    private static class StubStreamingModel implements StreamingChatModel {
        private final boolean completeImmediately;
        private final boolean emitThinking;
        private StreamingChatResponseHandler handler;

        StubStreamingModel(boolean completeImmediately) {
            this(completeImmediately, false);
        }

        StubStreamingModel(boolean completeImmediately, boolean emitThinking) {
            this.completeImmediately = completeImmediately;
            this.emitThinking = emitThinking;
        }

        @Override
        public void doChat(ChatRequest request, StreamingChatResponseHandler handler) {
            this.handler = handler;
            if (completeImmediately) {
                if (emitThinking) {
                    handler.onPartialThinking(new PartialThinking("先规划工程"));
                }
                handler.onPartialResponse("准备生成");
                handler.onPartialResponse("生成完毕");
                handler.onCompleteResponse(ChatResponse.builder()
                        .aiMessage(AiMessage.from("准备生成生成完毕"))
                        .build());
            }
        }
    }
}
