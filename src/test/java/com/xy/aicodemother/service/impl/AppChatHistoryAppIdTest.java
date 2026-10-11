package com.xy.aicodemother.service.impl;

import cn.hutool.json.JSONUtil;
import com.xy.aicodemother.ai.model.AiResponseMessage;
import com.xy.aicodemother.core.AiCodeGeneratorFacade;
import com.xy.aicodemother.core.builder.VueProjectBuilder;
import com.xy.aicodemother.core.handler.JsonMessageStreamHandler;
import com.xy.aicodemother.core.handler.StreamHandlerExecutor;
import com.xy.aicodemother.exception.BusinessException;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.model.entity.App;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;
import com.xy.aicodemother.service.ChatHistoryService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Flux;

import java.io.Serializable;
import java.lang.reflect.Proxy;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** 使用不同的应用/用户 ID，验证真实流处理器成功和失败时的历史归属，无需数据库或 AI。 */
class AppChatHistoryAppIdTest {

    private static final long APP_ID = 466403414818037760L;
    private static final long USER_ID = 17L;
    private static final String PROMPT = "创建网站";
    private static final String AI_RESPONSE = "生成完成";
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    @Test
    void allGenerationTypesSaveUserAndAiMessagesUnderTheRequestedApp() {
        for (CodeGenTypeEnum type : CodeGenTypeEnum.values()) {
            Fixture fixture = fixture(type, Flux.just(chunk(type)));

            assertEquals(List.of(AI_RESPONSE), fixture.service()
                    .chatToGenCode(APP_ID, PROMPT, fixture.loginUser()).collectList().block(TIMEOUT));
            assertEquals(List.of(
                    new SavedHistory(APP_ID, USER_ID, "user", PROMPT),
                    new SavedHistory(APP_ID, USER_ID, "ai", AI_RESPONSE)), fixture.history(), type.name());
        }
    }

    @Test
    void allGenerationTypesSaveFailureMessagesUnderTheRequestedApp() {
        for (CodeGenTypeEnum type : CodeGenTypeEnum.values()) {
            IllegalStateException expected = new IllegalStateException("模型连接失败");
            Fixture fixture = fixture(type, Flux.just(chunk(type)).concatWith(Flux.error(expected)));

            IllegalStateException actual = assertThrows(IllegalStateException.class, () -> fixture.service()
                    .chatToGenCode(APP_ID, PROMPT, fixture.loginUser()).collectList().block(TIMEOUT));
            assertSame(expected, actual, type.name());
            assertEquals(List.of(
                    new SavedHistory(APP_ID, USER_ID, "user", PROMPT),
                    new SavedHistory(APP_ID, USER_ID, "ai", "AI回复失败: 模型连接失败")),
                    fixture.history(), type.name());
        }
    }

    private static String chunk(CodeGenTypeEnum type) {
        return type == CodeGenTypeEnum.VUE_PROJECT
                ? JSONUtil.toJsonStr(new AiResponseMessage(AI_RESPONSE)) : AI_RESPONSE;
    }

    private static Fixture fixture(CodeGenTypeEnum type, Flux<String> codeStream) {
        App app = new App();
        app.setId(APP_ID);
        app.setUserId(USER_ID);
        app.setCodeGenType(type.getValue());
        User loginUser = new User();
        loginUser.setId(USER_ID);
        AppServiceImpl service = new AppServiceImpl() {
            @Override
            public App getById(Serializable id) {
                return Long.valueOf(APP_ID).equals(id) ? app : null;
            }
        };

        List<SavedHistory> history = new ArrayList<>();
        ChatHistoryService historyService = (ChatHistoryService) Proxy.newProxyInstance(
                ChatHistoryService.class.getClassLoader(), new Class<?>[]{ChatHistoryService.class},
                (proxy, method, arguments) -> {
                    if (!"addChatHistory".equals(method.getName())) {
                        throw new AssertionError("本测试不应调用其他历史接口");
                    }
                    // 模拟按 appId 查询应用：把 userId 误传为 appId 时重现“应用不存在”。
                    Long requestedAppId = (Long) arguments[0];
                    if (!Long.valueOf(APP_ID).equals(requestedAppId)) {
                        throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "应用不存在");
                    }
                    history.add(new SavedHistory(requestedAppId, (Long) arguments[3],
                            (String) arguments[2], (String) arguments[1]));
                    return true;
                });
        AiCodeGeneratorFacade facade = new AiCodeGeneratorFacade() {
            @Override
            public Flux<String> generateAndSaveCodeMessageStream(String userMessage,
                                                                CodeGenTypeEnum codeGenType, Long appId) {
                assertEquals(APP_ID, appId);
                assertEquals(type, codeGenType);
                return codeStream;
            }
        };
        StreamHandlerExecutor executor = new StreamHandlerExecutor();
        JsonMessageStreamHandler handler = new JsonMessageStreamHandler();
        ReflectionTestUtils.setField(handler, "vueProjectBuilder", new VueProjectBuilder() {
            @Override
            public boolean buildProject(String projectPath) {
                return true;
            }
        });
        ReflectionTestUtils.setField(executor, "jsonMessageStreamHandler", handler);
        ReflectionTestUtils.setField(service, "streamHandlerExecutor", executor);
        ReflectionTestUtils.setField(service, "aiCodeGeneratorFacade", facade);
        ReflectionTestUtils.setField(service, "chatHistoryService", historyService);
        return new Fixture(service, loginUser, history);
    }

    private record Fixture(AppServiceImpl service, User loginUser, List<SavedHistory> history) {
    }

    private record SavedHistory(long appId, long userId, String type, String message) {
    }
}
