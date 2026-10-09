package com.xy.aicodemother.ai.tools;

import com.xy.aicodemother.config.ProjectToolProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** 本地假可执行程序验证超时和日志上限，不安装依赖、不调用 Docker。 */
@EnabledOnOs({OS.LINUX, OS.MAC})
class DefaultProjectCommandRunnerTest {

    @TempDir
    Path tempDirectory;

    @Test
    void drainsLargeOutputAndKillsTimedOutChild() throws Exception {
        Path fakeNpm = tempDirectory.resolve("fake-npm");
        Files.writeString(fakeNpm, "#!/bin/sh\n"
                + "i=0\nwhile [ \"$i\" -lt 10000 ]; do echo 'large-log-line'; i=$((i+1)); done\n"
                + "exec sleep 30\n");
        assertTrue(fakeNpm.toFile().setExecutable(true));
        ProjectToolProperties properties = new ProjectToolProperties();
        properties.setExecutionMode("local");
        properties.setNpmExecutable(fakeNpm.toString());
        properties.setCommandTimeoutSeconds(1);
        long start = System.nanoTime();
        var result = new DefaultProjectCommandRunner().run(tempDirectory, List.of("run", "build"), properties);
        assertEquals("TIMEOUT", result.status());
        assertTrue(result.logs().contains("日志已截断"));
        assertTrue(result.logs().length() < 66_000);
        assertTrue((System.nanoTime() - start) / 1_000_000_000L < 8);
    }

    @Test
    void doesNotPassHostSecretsToLocalCommand() throws Exception {
        Path fakeNpm = tempDirectory.resolve("fake-npm");
        Files.writeString(fakeNpm, "#!/bin/sh\nprintf '%s\\n' \"$HOME\" \"$npm_config_ignore_scripts\"\n");
        assertTrue(fakeNpm.toFile().setExecutable(true));
        ProjectToolProperties properties = new ProjectToolProperties();
        properties.setExecutionMode("local");
        properties.setNpmExecutable(fakeNpm.toString());
        var result = new DefaultProjectCommandRunner().run(tempDirectory, List.of("run", "type-check"), properties);
        assertTrue(result.successful());
        assertTrue(result.logs().contains(tempDirectory.resolve(".runner-home").toString()));
        assertTrue(result.logs().contains("true"));
    }
}
