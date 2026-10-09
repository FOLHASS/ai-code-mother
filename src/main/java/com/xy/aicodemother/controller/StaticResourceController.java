package com.xy.aicodemother.controller;

import com.xy.aicodemother.constant.AppConstant;
import com.xy.aicodemother.config.ProjectToolProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.HandlerMapping;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.LinkOption;
import java.nio.file.Path;

@RestController
@RequestMapping("/static")
@Slf4j
public class StaticResourceController {

    private final ProjectToolProperties projectToolProperties;

    public StaticResourceController(ProjectToolProperties projectToolProperties) {
        this.projectToolProperties = projectToolProperties;
    }

    /**
     * 提供生成网站的静态预览资源，支持目录重定向。
     *
     * <p>Vue 工程只提供 publish_preview 发布的 dist 内容；HTML 和原生多文件模式
     * 保留原来的生成目录。此处的路径标识为 codeGenType_appId，与部署网站的 deployKey 不同。</p>
     */
    @GetMapping("/{deployKey}/**")
    public ResponseEntity<Resource> serveStaticResource(
            @PathVariable String deployKey,
            HttpServletRequest request) {
        try {
            // 路径标识只能是一个目录名，禁止将上级目录或绝对路径当成应用标识。
            if (!deployKey.matches("[a-zA-Z0-9_-]+")) {
                return ResponseEntity.badRequest().build();
            }
            // 获取资源路径
            String resourcePath = (String) request.getAttribute(HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE);
            if (resourcePath == null || !resourcePath.startsWith("/static/" + deployKey)) {
                return ResponseEntity.badRequest().build();
            }
            resourcePath = resourcePath.substring(("/static/" + deployKey).length());
            // 如果是目录访问（不带斜杠），重定向到带斜杠的URL
            if (resourcePath.isEmpty()) {
                HttpHeaders headers = new HttpHeaders();
                headers.add("Location", request.getRequestURI() + "/");
                return new ResponseEntity<>(headers, HttpStatus.MOVED_PERMANENTLY);
            }
            // 默认返回 index.html
            if (resourcePath.equals("/")) {
                resourcePath = "/index.html";
            }
            Path root = Path.of(deployKey.startsWith("vue_project_")
                    ? projectToolProperties.getPreviewRoot() : AppConstant.CODE_OUTPUT_ROOT_DIR)
                    .toAbsolutePath().normalize();
            Path appRoot = root.resolve(deployKey).normalize();
            Path file = appRoot.resolve(resourcePath.substring(1)).normalize();
            // 先校验文本路径，再校验真实路径，防止 ../ 和符号链接绕过应用隔离。
            if (!file.startsWith(appRoot) || Files.isSymbolicLink(appRoot)) {
                return ResponseEntity.badRequest().build();
            }
            if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) {
                return ResponseEntity.notFound().build();
            }
            if (!file.toRealPath().startsWith(appRoot.toRealPath())) {
                return ResponseEntity.badRequest().build();
            }
            // 返回文件资源
            Resource resource = new FileSystemResource(file);
            return ResponseEntity.ok()
                    .header("Content-Type", getContentTypeWithCharset(file.toString()))
                    .header("X-Content-Type-Options", "nosniff")
                    .body(resource);
        } catch (InvalidPathException e) {
            return ResponseEntity.badRequest().build();
        } catch (IOException e) {
            log.error("静态预览资源读取失败，应用标识={}", deployKey, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * 根据文件扩展名返回带字符编码的 Content-Type
     */
    private String getContentTypeWithCharset(String filePath) {
        if (filePath.endsWith(".html")) return "text/html; charset=UTF-8";
        if (filePath.endsWith(".css")) return "text/css; charset=UTF-8";
        if (filePath.endsWith(".js")) return "application/javascript; charset=UTF-8";
        if (filePath.endsWith(".png")) return "image/png";
        if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
        if (filePath.endsWith(".svg")) return "image/svg+xml";
        if (filePath.endsWith(".webp")) return "image/webp";
        if (filePath.endsWith(".ico")) return "image/x-icon";
        if (filePath.endsWith(".woff")) return "font/woff";
        if (filePath.endsWith(".woff2")) return "font/woff2";
        if (filePath.endsWith(".json")) return "application/json; charset=UTF-8";
        return "application/octet-stream";
    }
}
