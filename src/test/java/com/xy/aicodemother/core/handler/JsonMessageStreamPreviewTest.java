package com.xy.aicodemother.core.handler;

import cn.hutool.json.JSONUtil;
import com.xy.aicodemother.ai.model.AiResponseMessage;
import com.xy.aicodemother.constant.AppConstant;
import com.xy.aicodemother.core.builder.VueProjectBuilder;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.service.ChatHistoryService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;

import java.lang.reflect.Proxy;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/** 使用构建替身验证预览准备完成后才结束流，无需 AI、数据库或 npm。 */
class JsonMessageStreamPreviewTest {

    private static final long APP_ID = 3L;
    private static final long USER_ID = 9L;
    private static final String RESPONSE = "网站生成完成";
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    @Test
    void waitsForBuildBeforeSavingSuccessHistoryAndCompletingStream() throws Exception {
        List<String> events = new CopyOnWriteArrayList<>();
        List<String> history = new CopyOnWriteArrayList<>();
        CountDownLatch buildStarted = new CountDownLatch(1);
        CountDownLatch finishBuild = new CountDownLatch(1);
        CountDownLatch streamFinished = new CountDownLatch(1);
        AtomicBoolean completed = new AtomicBoolean();
        AtomicReference<Throwable> failure = new AtomicReference<>();
        JsonMessageStreamHandler handler = handler(new VueProjectBuilder() {
            @Override
            public boolean buildProject(String projectPath) {
                assertEquals(AppConstant.CODE_OUTPUT_ROOT_DIR + "/vue_project_" + APP_ID, projectPath);
                events.add("build-start");
                buildStarted.countDown();
                try {
                    if (!finishBuild.await(5, TimeUnit.SECONDS)) {
                        throw new AssertionError("构建测试未释放完成信号");
                    }
                } catch (InterruptedException error) {
                    Thread.currentThread().interrupt();
                    throw new AssertionError(error);
                }
                events.add("build-end");
                return true;
            }
        });
        Disposable subscription = handler.handle(source(), historyService(history, events), APP_ID, user())
                .subscribe(chunk -> events.add("message"), error -> {
                    failure.set(error);
                    streamFinished.countDown();
                }, () -> {
                    events.add("done");
                    completed.set(true);
                    streamFinished.countDown();
                });
        try {
            assertTrue(buildStarted.await(5, TimeUnit.SECONDS));
            assertTrue(history.isEmpty(), "构建尚未完成，不能落库为成功回复");
            assertFalse(completed.get(), "构建尚未完成，前端不能收到完成信号");
            assertEquals(List.of("message", "build-start"), events);
            finishBuild.countDown();
            assertTrue(streamFinished.await(5, TimeUnit.SECONDS));
            assertNull(failure.get());
            assertEquals(List.of(RESPONSE), history);
            assertEquals(List.of("message", "build-start", "build-end", "history", "done"), events);
        } finally {
            finishBuild.countDown();
            subscription.dispose();
        }
    }

    @Test
    void failedBuildRecordsFailureAndDoesNotCompleteSuccessfully() {
        List<String> history = new CopyOnWriteArrayList<>();
        AtomicBoolean completed = new AtomicBoolean();
        JsonMessageStreamHandler handler = handler(new VueProjectBuilder() {
            @Override
            public boolean buildProject(String projectPath) {
                return false;
            }
        });

        RuntimeException failure = assertThrows(RuntimeException.class, () -> handler
                .handle(source(), historyService(history, new CopyOnWriteArrayList<>()), APP_ID, user())
                .doOnComplete(() -> completed.set(true)).collectList().block(TIMEOUT));

        assertTrue(failure.getMessage().contains("构建"));
        assertFalse(completed.get());
        assertEquals(1, history.size());
        assertTrue(history.getFirst().startsWith("AI回复失败:"));
        assertTrue(history.getFirst().contains("构建"));
        assertFalse(history.contains(RESPONSE));
    }

    @Test
    void buildExceptionPropagatesAndRecordsOnlyFailureHistory() {
        List<String> history = new CopyOnWriteArrayList<>();
        IllegalStateException expected = new IllegalStateException("构建进程异常");
        JsonMessageStreamHandler handler = handler(new VueProjectBuilder() {
            @Override
            public boolean buildProject(String projectPath) {
                throw expected;
            }
        });

        IllegalStateException actual = assertThrows(IllegalStateException.class, () -> handler
                .handle(source(), historyService(history, new CopyOnWriteArrayList<>()), APP_ID, user())
                .collectList().block(TIMEOUT));

        assertSame(expected, actual);
        assertEquals(List.of("AI回复失败: 构建进程异常"), history);
    }

    private static JsonMessageStreamHandler handler(VueProjectBuilder builder) {
        JsonMessageStreamHandler handler = new JsonMessageStreamHandler();
        ReflectionTestUtils.setField(handler, "vueProjectBuilder", builder);
        return handler;
    }

    private static Flux<String> source() {
        return Flux.just(JSONUtil.toJsonStr(new AiResponseMessage(RESPONSE)));
    }

    private static User user() {
        User user = new User();
        user.setId(USER_ID);
        return user;
    }

    private static ChatHistoryService historyService(List<String> history, List<String> events) {
        return (ChatHistoryService) Proxy.newProxyInstance(ChatHistoryService.class.getClassLoader(),
                new Class<?>[]{ChatHistoryService.class}, (proxy, method, arguments) -> {
                    assertEquals("addChatHistory", method.getName());
                    assertEquals(APP_ID, arguments[0]);
                    assertEquals(USER_ID, arguments[3]);
                    assertEquals("ai", arguments[2]);
                    history.add((String) arguments[1]);
                    events.add("history");
                    return true;
                });
    }
}
