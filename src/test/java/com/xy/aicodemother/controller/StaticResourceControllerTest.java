package com.xy.aicodemother.controller;

import com.xy.aicodemother.config.ProjectToolProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.servlet.HandlerMapping;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

/** 验证工程预览只提供发布产物，不能通过路径或链接访问源码及其他应用。 */
class StaticResourceControllerTest {

    @TempDir
    Path tempDirectory;

    private StaticResourceController controller;
    private Path preview;

    @BeforeEach
    void setUp() throws Exception {
        ProjectToolProperties properties = new ProjectToolProperties();
        properties.setPreviewRoot(tempDirectory.resolve("previews").toString());
        controller = new StaticResourceController(properties);
        preview = Path.of(properties.getPreviewRoot()).resolve("vue_project_123");
        Files.createDirectories(preview.resolve("assets"));
        Files.writeString(preview.resolve("index.html"), "published-site");
        Files.writeString(preview.resolve("assets/main.js"), "console.log('preview')");
    }

    @Test
    void servesPublishedIndexAndAssetsAtExistingPreviewUrl() throws Exception {
        var index = controller.serveStaticResource("vue_project_123", request("/"));
        assertEquals(200, index.getStatusCode().value());
        assertNotNull(index.getBody());
        assertEquals("published-site", index.getBody().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        assertEquals("nosniff", index.getHeaders().getFirst("X-Content-Type-Options"));
        assertEquals(200, controller.serveStaticResource("vue_project_123", request("/assets/main.js"))
                .getStatusCode().value());
        assertEquals(404, controller.serveStaticResource("vue_project_123", request("/package.json"))
                .getStatusCode().value());
    }

    @Test
    void rejectsTraversalAndCrossApplicationSymlinks() throws Exception {
        assertEquals(400, controller.serveStaticResource("vue_project_123", request("/../secret.txt"))
                .getStatusCode().value());
        Path outside = tempDirectory.resolve("secret.txt");
        Files.writeString(outside, "private");
        Files.createSymbolicLink(preview.resolve("secret.txt"), outside);
        assertEquals(404, controller.serveStaticResource("vue_project_123", request("/secret.txt"))
                .getStatusCode().value());
        Files.createSymbolicLink(preview.resolve("other"), tempDirectory);
        assertEquals(400, controller.serveStaticResource("vue_project_123", request("/other/secret.txt"))
                .getStatusCode().value());
    }

    private MockHttpServletRequest request(String suffix) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/static/vue_project_123" + suffix);
        request.setAttribute(HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE,
                "/static/vue_project_123" + suffix);
        return request;
    }
}
