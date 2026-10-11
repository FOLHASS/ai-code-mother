package com.xy.aicodemother.controller;

import com.xy.aicodemother.config.ProjectToolProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.servlet.HandlerMapping;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

/** 验证工程预览提供构建和发布产物，不能通过路径或链接访问源码及其他应用。 */
class StaticResourceControllerTest {

    @TempDir
    Path tempDirectory;

    private StaticResourceController controller;
    private Path preview;
    private Path workspace;
    private Path dist;

    @BeforeEach
    void setUp() throws Exception {
        ProjectToolProperties properties = new ProjectToolProperties();
        properties.setPreviewRoot(tempDirectory.resolve("previews").toString());
        properties.setWorkspaceRoot(tempDirectory.resolve("sources").toString());
        controller = new StaticResourceController(properties);
        preview = Path.of(properties.getPreviewRoot()).resolve("vue_project_123");
        Files.createDirectories(preview.resolve("assets"));
        Files.writeString(preview.resolve("index.html"), "published-site");
        Files.writeString(preview.resolve("assets/main.js"), "console.log('preview')");
        workspace = Path.of(properties.getWorkspaceRoot());
        Path project = workspace.resolve("vue_project_123");
        dist = project.resolve("dist");
        Files.createDirectories(dist.resolve("assets"));
        Files.writeString(dist.resolve("index.html"), "built-site");
        Files.writeString(dist.resolve("assets/main.js"), "console.log('built')");
        Files.writeString(dist.resolve("assets/main.css"), "body { color: green; }");
        Files.createDirectories(project.resolve("src"));
        Files.writeString(project.resolve("package.json"), "private-package");
        Files.writeString(project.resolve("src/main.js"), "private-source");
    }

    @Test
    void servesPublishedIndexAndAssetsAtExistingPreviewUrl() throws Exception {
        var index = controller.serveStaticResource("vue_project_123", request("/"));
        assertEquals(200, index.getStatusCode().value());
        assertNotNull(index.getBody());
        assertEquals("published-site", index.getBody().getContentAsString(StandardCharsets.UTF_8));
        assertEquals("nosniff", index.getHeaders().getFirst("X-Content-Type-Options"));
        assertEquals(200, controller.serveStaticResource("vue_project_123", request("/assets/main.js"))
                .getStatusCode().value());
        assertEquals(404, controller.serveStaticResource("vue_project_123", request("/package.json"))
                .getStatusCode().value());
    }

    @Test
    void servesBuiltIndexAndAssetsAtDistPreviewUrl() throws Exception {
        for (String suffix : new String[]{"/dist/", "/dist/index.html"}) {
            var index = controller.serveStaticResource("vue_project_123", request(suffix));
            assertEquals(200, index.getStatusCode().value());
            assertNotNull(index.getBody());
            assertEquals("built-site", index.getBody().getContentAsString(StandardCharsets.UTF_8));
            assertEquals("text/html; charset=UTF-8", index.getHeaders().getFirst("Content-Type"));
            assertEquals("no-cache", index.getHeaders().getCacheControl());
        }
        var script = controller.serveStaticResource("vue_project_123", request("/dist/assets/main.js"));
        assertEquals(200, script.getStatusCode().value());
        assertNotNull(script.getBody());
        assertEquals("console.log('built')", script.getBody().getContentAsString(StandardCharsets.UTF_8));
        assertEquals("application/javascript; charset=UTF-8", script.getHeaders().getFirst("Content-Type"));
        assertEquals("nosniff", script.getHeaders().getFirst("X-Content-Type-Options"));
        var style = controller.serveStaticResource("vue_project_123", request("/dist/assets/main.css"));
        assertEquals(200, style.getStatusCode().value());
        assertNotNull(style.getBody());
        assertEquals("body { color: green; }", style.getBody().getContentAsString(StandardCharsets.UTF_8));
        assertEquals("text/css; charset=UTF-8", style.getHeaders().getFirst("Content-Type"));
    }

    @Test
    void redirectsDistDirectoryToPreserveRelativeAssetUrls() throws Exception {
        var response = controller.serveStaticResource("vue_project_123", request("/dist"));
        assertEquals(301, response.getStatusCode().value());
        assertEquals("/api/static/vue_project_123/dist/", response.getHeaders().getFirst("Location"));
    }

    @Test
    void distPreviewCannotExposeSourceThroughRequestsOrTraversal() throws Exception {
        assertEquals(404, controller.serveStaticResource("vue_project_123", request("/dist/package.json"))
                .getStatusCode().value());
        assertEquals(404, controller.serveStaticResource("vue_project_123", request("/dist/src/main.js"))
                .getStatusCode().value());
        assertEquals(400, controller.serveStaticResource("vue_project_123", request("/dist/../package.json"))
                .getStatusCode().value());
        assertEquals(400, controller.serveStaticResource("vue_project_123", request("/dist/../src/main.js"))
                .getStatusCode().value());
    }

    @Test
    void distPreviewRejectsResourceAndDirectorySymlinks() throws Exception {
        Path outside = tempDirectory.resolve("private-site");
        Files.createDirectories(outside.resolve("dist"));
        Files.writeString(outside.resolve("dist/index.html"), "private-site");
        Files.createSymbolicLink(dist.resolve("index-link.html"), outside.resolve("dist/index.html"));
        assertEquals(404, controller.serveStaticResource("vue_project_123", request("/dist/index-link.html"))
                .getStatusCode().value());
        Files.createSymbolicLink(dist.resolve("other"), outside);
        assertEquals(400, controller.serveStaticResource("vue_project_123", request("/dist/other/dist/index.html"))
                .getStatusCode().value());
        Files.createSymbolicLink(workspace.resolve("vue_project_456"), outside);
        assertEquals(400, controller.serveStaticResource("vue_project_456", request("vue_project_456", "/dist/"))
                .getStatusCode().value());
        Path otherProject = workspace.resolve("vue_project_789");
        Files.createDirectory(otherProject);
        Files.createSymbolicLink(otherProject.resolve("dist"), outside.resolve("dist"));
        assertEquals(400, controller.serveStaticResource("vue_project_789", request("vue_project_789", "/dist/"))
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
        return request("vue_project_123", suffix);
    }

    private MockHttpServletRequest request(String appDirectory, String suffix) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/static/" + appDirectory + suffix);
        request.setAttribute(HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE,
                "/static/" + appDirectory + suffix);
        return request;
    }
}
