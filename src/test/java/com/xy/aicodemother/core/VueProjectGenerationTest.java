package com.xy.aicodemother.core;

import com.xy.aicodemother.ai.AiCodeGeneratorService;
import com.xy.aicodemother.ai.AiCodeGeneratorServiceFactory;
import com.xy.aicodemother.ai.tools.ProjectBuildService;
import com.xy.aicodemother.ai.tools.ProjectWorkspace;
import com.xy.aicodemother.config.ProjectToolProperties;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Flux;

import java.util.List;
import java.lang.reflect.Proxy;

import static org.junit.jupiter.api.Assertions.*;

/** 不调用真实 AI，验证 Vue 走工程工具并在构建/发布完成后才结束生成。 */
class VueProjectGenerationTest {

    private StubFactory factory;
    private StubBuildService buildService;
    private AiCodeGeneratorFacade facade;

    @BeforeEach
    void setUp() {
        // 手写替身避免测试依赖 JVM 动态 agent attach，受限制的开发环境同样可执行。
        AiCodeGeneratorService aiService = (AiCodeGeneratorService) Proxy.newProxyInstance(
                AiCodeGeneratorService.class.getClassLoader(), new Class<?>[]{AiCodeGeneratorService.class},
                (proxy, method, arguments) -> {
                    if (!"generateVueProjectCodeStream".equals(method.getName())) {
                        throw new AssertionError("Vue 工程不应调用原生代码生成方法");
                    }
                    assertEquals(3L, arguments[0]);
                    assertEquals("任务网站", arguments[1]);
                    return Flux.just("准备生成", "生成完毕");
                });
        factory = new StubFactory(aiService);
        buildService = new StubBuildService();
        facade = new AiCodeGeneratorFacade();
        ReflectionTestUtils.setField(facade, "aiCodeGeneratorServiceFactory", factory);
        ReflectionTestUtils.setField(facade, "projectBuildService", buildService);
    }

    @Test
    void selectsVueToolsAndWaitsForPublishedPreview() {
        List<String> chunks = facade.generateAndSaveCodeStream("任务网站", CodeGenTypeEnum.VUE_PROJECT, 3L)
                .collectList().block(java.time.Duration.ofSeconds(5));
        assertEquals(List.of("准备生成", "生成完毕"), chunks);
        assertEquals(CodeGenTypeEnum.VUE_PROJECT, factory.selectedType);
        assertEquals(1, buildService.calls);
    }

    @Test
    void failedBuildDoesNotCompleteAsSuccessfulGeneration() {
        buildService.fail = true;
        ProjectWorkspace.WorkspaceException error = assertThrows(ProjectWorkspace.WorkspaceException.class,
                () -> facade.generateAndSaveCodeStream("任务网站", CodeGenTypeEnum.VUE_PROJECT, 3L)
                        .collectList().block(java.time.Duration.ofSeconds(5)));
        assertEquals("构建失败", error.getMessage());
    }

    private static class StubFactory extends AiCodeGeneratorServiceFactory {
        private final AiCodeGeneratorService aiService;
        private CodeGenTypeEnum selectedType;

        StubFactory(AiCodeGeneratorService aiService) {
            this.aiService = aiService;
        }

        @Override
        public AiCodeGeneratorService getAiCodeGeneratorService(long appId, CodeGenTypeEnum type) {
            assertEquals(3L, appId);
            selectedType = type;
            return aiService;
        }

        @Override
        public AiCodeGeneratorService getAiCodeGeneratorService(long appId) {
            throw new AssertionError("必须将 Vue 类型传给工厂，不能选择默认 HTML 模式");
        }
    }

    private static class StubBuildService extends ProjectBuildService {
        private int calls;
        private boolean fail;

        StubBuildService() {
            super(new ProjectWorkspace(new ProjectToolProperties()), new ProjectToolProperties(),
                    (directory, arguments, properties) -> {
                        throw new AssertionError("本测试不应执行真实构建命令");
                    });
        }

        @Override
        public String ensurePreview(Long appId) {
            assertEquals(3L, appId);
            calls++;
            if (fail) {
                throw new ProjectWorkspace.WorkspaceException("构建失败");
            }
            return "http://localhost:8123/api/static/vue_project_3/";
        }
    }
}
