package com.xy.aicodemother.controller;

import cn.hutool.json.JSONUtil;
import com.xy.aicodemother.exception.BusinessException;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.service.AppService;
import com.xy.aicodemother.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Flux;

import java.lang.reflect.Proxy;
import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** 直接调用控制器验证生成结果的 SSE 完成/错误事件，不启动数据库、模型或真实构建。 */
class AppPreviewSseTest {

    private static final long APP_ID = 3L;
    private static final long USER_ID = 9L;
    private static final String PROMPT = "创建博客";

    @Test
    void successfulGenerationSendsTextChunksBeforeDone() {
        List<ServerSentEvent<String>> events = events(Flux.just("生成中", "生成完成"));

        assertEquals(3, events.size());
        assertNull(events.getFirst().event());
        assertEquals("生成中", JSONUtil.parseObj(events.getFirst().data()).getStr("d"));
        assertEquals("生成完成", JSONUtil.parseObj(events.get(1).data()).getStr("d"));
        assertEquals("done", events.getLast().event());
        assertEquals("", events.getLast().data());
        assertFalse(events.stream().anyMatch(event -> "error".equals(event.event())));
    }

    @Test
    void buildFailureAfterTextSendsErrorWithoutDone() {
        BusinessException failure = new BusinessException(ErrorCode.SYSTEM_ERROR, "Vue 项目构建失败");
        List<ServerSentEvent<String>> events = events(Flux.just("源码已写入")
                .concatWith(Flux.error(failure)));

        assertEquals(2, events.size());
        assertEquals("源码已写入", JSONUtil.parseObj(events.getFirst().data()).getStr("d"));
        assertEquals("error", events.getLast().event());
        assertEquals("Vue 项目构建失败", JSONUtil.parseObj(events.getLast().data()).getStr("message"));
        assertFalse(events.stream().anyMatch(event -> "done".equals(event.event())));
    }

    @Test
    void unexpectedFailureUsesAGenericErrorMessage() {
        String internalDetails = "内部错误 /private/source/config.sql credential=TEST_ONLY";
        List<ServerSentEvent<String>> events = events(Flux.error(new IllegalStateException(internalDetails)));

        assertEquals(1, events.size());
        assertEquals("error", events.getFirst().event());
        assertEquals("代码生成失败，请稍后重试", JSONUtil.parseObj(events.getFirst().data()).getStr("message"));
        assertFalse(events.getFirst().data().contains(internalDetails));
        assertFalse(events.stream().anyMatch(event -> "done".equals(event.event())));
    }

    private static List<ServerSentEvent<String>> events(Flux<String> source) {
        User user = new User();
        user.setId(USER_ID);
        MockHttpServletRequest request = new MockHttpServletRequest();
        UserService userService = (UserService) Proxy.newProxyInstance(UserService.class.getClassLoader(),
                new Class<?>[]{UserService.class}, (proxy, method, arguments) -> {
                    assertEquals("getLoginUser", method.getName());
                    assertSame(request, arguments[0]);
                    return user;
                });
        AppService appService = (AppService) Proxy.newProxyInstance(AppService.class.getClassLoader(),
                new Class<?>[]{AppService.class}, (proxy, method, arguments) -> {
                    assertEquals("chatToGenCode", method.getName());
                    assertEquals(APP_ID, arguments[0]);
                    assertEquals(PROMPT, arguments[1]);
                    assertSame(user, arguments[2]);
                    return source;
                });
        AppController controller = new AppController();
        ReflectionTestUtils.setField(controller, "userService", userService);
        ReflectionTestUtils.setField(controller, "appService", appService);

        List<ServerSentEvent<String>> events = controller.chatToGenCode(APP_ID, PROMPT, request)
                .collectList().block(Duration.ofSeconds(5));
        assertNotNull(events);
        return events;
    }
}
