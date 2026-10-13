package com.xy.aicodemother.service;

import com.xy.aicodemother.service.impl.DownloadServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.junit.jupiter.api.Assertions.*;

class DownloadServiceImplTest {

    @TempDir
    Path tempDir;

    @Test
    void downloadsSourceZipWithFilenameAndExcludesDependencies() throws Exception {
        Path project = tempDir.resolve("project");
        Files.createDirectories(project.resolve("src"));
        Files.writeString(project.resolve("src/App.vue"), "<template>个人博客</template>");
        Files.createDirectories(project.resolve("node_modules"));
        Files.writeString(project.resolve("node_modules/dependency.js"), "export {}");
        Files.createDirectories(project.resolve("dist"));
        Files.writeString(project.resolve("dist/index.html"), "<html></html>");

        MockHttpServletResponse response = new MockHttpServletResponse();
        new DownloadServiceImpl().downloadCodeAsZip(project.toString(), "个人博客", response);

        assertEquals(200, response.getStatus());
        assertEquals("application/zip", response.getContentType());
        assertEquals("attachment; filename=\"个人博客.zip\"", response.getHeader("Content-Disposition"));

        List<String> entryNames = new ArrayList<>();
        try (ZipInputStream archive = new ZipInputStream(new ByteArrayInputStream(response.getContentAsByteArray()))) {
            ZipEntry entry;
            while ((entry = archive.getNextEntry()) != null) {
                entryNames.add(entry.getName());
            }
        }
        assertTrue(entryNames.stream().anyMatch(name -> name.endsWith("src/App.vue")));
        assertTrue(entryNames.stream().noneMatch(name -> name.contains("node_modules") || name.contains("dist/")));
    }
}
