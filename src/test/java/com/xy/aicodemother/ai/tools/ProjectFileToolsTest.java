package com.xy.aicodemother.ai.tools;

import com.xy.aicodemother.ai.tools.model.ProjectFileListing;
import com.xy.aicodemother.ai.tools.model.ProjectFileMutation;
import com.xy.aicodemother.ai.tools.model.ProjectFileSnapshot;
import com.xy.aicodemother.ai.tools.model.ProjectSearchResult;
import com.xy.aicodemother.ai.tools.model.ProjectToolResult;
import com.xy.aicodemother.config.ProjectToolProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 使用临时目录验证路径隔离、乐观版本控制、文本补丁和工程快照；不依赖 AI 或数据库。
 */
class ProjectFileToolsTest {

    @TempDir
    Path temporaryDirectory;

    private ProjectToolProperties properties;
    private ProjectWorkspace workspace;
    private ProjectFileTools tools;

    @BeforeEach
    void setUp() {
        properties = new ProjectToolProperties();
        properties.setWorkspaceRoot(temporaryDirectory.resolve("sources").toString());
        workspace = new ProjectWorkspace(properties);
        tools = new ProjectFileTools(workspace);
    }

    @Test
    void createsReadsAndAtomicallyUpdatesUtf8FileWithoutOverwritingOnCreate() throws Exception {
        assertTrue(tools.createFile("src/App.vue", "<template>任务</template>", 1L).success());
        ProjectFileSnapshot original = snapshot("src/App.vue");
        assertEquals(ProjectWorkspace.sha256(original.content().getBytes(StandardCharsets.UTF_8)), original.sha256());
        assertEquals("src/App.vue", original.path());

        assertFalse(tools.createFile("src/App.vue", "覆盖", 1L).success());
        assertEquals(original.content(), snapshot("src/App.vue").content());

        ProjectToolResult<ProjectFileMutation> updated = tools.updateFile(
                "src/App.vue", original.sha256(), "<template>新任务</template>", 1L);
        assertTrue(updated.success());
        assertNotEquals(original.sha256(), updated.data().sha256());
        assertEquals("<template>新任务</template>", snapshot("src/App.vue").content());
        try (var files = Files.list(workspace.projectRoot(1L).resolve("src"))) {
            assertEquals(List.of("App.vue"), files.map(path -> path.getFileName().toString()).toList());
        }
    }

    @Test
    void staleHashCannotUpdatePatchOrDeleteFile() {
        tools.createFile("src/App.vue", "old", 1L);
        String previousHash = snapshot("src/App.vue").sha256();
        assertTrue(tools.updateFile("src/App.vue", previousHash, "new", 1L).success());

        assertFalse(tools.updateFile("src/App.vue", previousHash, "lost", 1L).success());
        assertFalse(tools.applyPatch("src/App.vue", previousHash, "new", "lost", 1L).success());
        assertFalse(tools.deleteFile("src/App.vue", previousHash, 1L).success());
        assertEquals("new", snapshot("src/App.vue").content());
    }

    @Test
    void patchRequiresAnExactUniqueSnippetAndRejectsOverlappingMatches() {
        tools.createFile("src/main.ts", "button button\ncolor: red", 1L);
        String hash = snapshot("src/main.ts").sha256();
        assertFalse(tools.applyPatch("src/main.ts", hash, "button", "link", 1L).success());
        assertFalse(tools.applyPatch("src/main.ts", hash, "missing", "link", 1L).success());
        assertFalse(tools.applyPatch("src/main.ts", hash, "", "link", 1L).success());
        assertTrue(tools.applyPatch("src/main.ts", hash, "color: red", "color: blue", 1L).success());
        assertEquals("button button\ncolor: blue", snapshot("src/main.ts").content());

        tools.createFile("src/overlap.txt", "aaa", 1L);
        assertFalse(tools.applyPatch("src/overlap.txt", snapshot("src/overlap.txt").sha256(),
                "aa", "x", 1L).success());
    }

    @Test
    void deletesOnlyOneVersionedFileAndKeepsSiblingAndOtherApps() {
        tools.createFile("src/main.ts", "app one", 1L);
        tools.createFile("src/other.ts", "sibling", 1L);
        tools.createFile("src/main.ts", "app two", 2L);

        assertFalse(tools.deleteFile("src/main.ts", null, 1L).success());
        assertTrue(tools.deleteFile("src/main.ts", snapshot("src/main.ts").sha256(), 1L).success());
        assertFalse(tools.readFile("src/main.ts", 1L).success());
        assertTrue(tools.readFile("src/other.ts", 1L).success());
        assertEquals("app two", tools.readFile("src/main.ts", 2L).data().content());
        assertFalse(tools.deleteFile("src", "0".repeat(64), 1L).success());
    }

    @Test
    void rejectsTraversalAbsoluteWindowsHiddenAndSecretPaths() {
        for (String path : List.of("../outside.ts", "src/../../outside.ts", "/tmp/outside.ts",
                "C:/outside.ts", "src\\outside.ts", ".env", ".env.local", ".npmrc", ".git/config",
                "node_modules/file.js", "dist/file.js", "src/build/file.js", "credentials.json", "logo.png")) {
            ProjectToolResult<ProjectFileMutation> result = tools.createFile(path, "forbidden", 1L);
            assertFalse(result.success(), path);
            assertFalse(result.message().contains(temporaryDirectory.toString()), path);
        }
        assertFalse(tools.createFile("src/main.ts", "missing context", null).success());
    }

    @Test
    void rejectsSymlinkFilesDirectoriesAndProjectRoot() throws Exception {
        tools.createFile("src/main.ts", "safe", 1L);
        Path outside = temporaryDirectory.resolve("outside.ts");
        Files.writeString(outside, "private");
        Path root = workspace.projectRoot(1L);
        Files.createSymbolicLink(root.resolve("src/link.ts"), outside);
        assertFalse(tools.readFile("src/link.ts", 1L).success());
        assertFalse(tools.createFile("src/link.ts", "overwrite", 1L).success());
        assertFalse(tools.listFiles(".", 1L).success());
        assertThrows(ProjectWorkspace.WorkspaceException.class, () -> workspace.fingerprint(1L));
        assertThrows(ProjectWorkspace.WorkspaceException.class,
                () -> workspace.copySource(1L, temporaryDirectory.resolve("bad-copy")));
        assertEquals("private", Files.readString(outside));

        Files.delete(root.resolve("src/link.ts"));
        Files.createSymbolicLink(root.resolve("linked"), temporaryDirectory);
        assertFalse(tools.createFile("linked/escaped.ts", "escape", 1L).success());
        Files.createSymbolicLink(root.getParent().resolve("vue_project_2"), root);
        assertFalse(tools.readFile("src/main.ts", 2L).success());
    }

    @Test
    void excludesDependenciesBuildsHiddenAndCredentialsFromListSearchAndSnapshots() throws Exception {
        tools.createFile("src/App.vue", "needle", 1L);
        tools.createFile("package-lock.json", "{}", 1L);
        Path root = workspace.projectRoot(1L);
        for (String name : List.of("node_modules/library.js", "dist/asset.js", ".git/index",
                ".env", "credentials.json", ".agent-run/result.json")) {
            Path file = root.resolve(name);
            Files.createDirectories(file.getParent());
            Files.writeString(file, "needle secret");
        }

        ProjectFileListing listing = tools.listFiles(".", 1L).data();
        assertEquals(List.of("package-lock.json", "src", "src/App.vue"),
                listing.entries().stream().map(entry -> entry.path()).toList());
        ProjectSearchResult search = tools.searchFiles("needle", 1L).data();
        assertEquals(1, search.matches().size());
        assertEquals("src/App.vue", search.matches().getFirst().path());

        String fingerprint = workspace.fingerprint(1L);
        Files.writeString(root.resolve(".env"), "changed");
        assertEquals(fingerprint, workspace.fingerprint(1L));
        Path copy = temporaryDirectory.resolve("snapshot");
        workspace.copySource(1L, copy);
        assertTrue(Files.exists(copy.resolve("package-lock.json")));
        assertTrue(Files.exists(copy.resolve("src/App.vue")));
        assertFalse(Files.exists(copy.resolve(".env")));
        assertFalse(Files.exists(copy.resolve("node_modules")));
        Files.writeString(root.resolve("package-lock.json"), "{\"version\": 2}");
        assertNotEquals(fingerprint, workspace.fingerprint(1L));
    }

    @Test
    void limitsListsSearchResultsAndContextAndUsesOneBasedLineNumbers() {
        tools.createFile("a.ts", "head\nneedle" + "x".repeat(500) + "\nneedle", 1L);
        tools.createFile("b.ts", "needle", 1L);
        properties.setMaxListEntries(1);
        properties.setMaxSearchResults(1);

        ProjectFileListing listing = tools.listFiles(".", 1L).data();
        assertEquals(1, listing.entries().size());
        assertTrue(listing.truncated());
        ProjectSearchResult result = tools.searchFiles("needle", 1L).data();
        assertEquals(1, result.matches().size());
        assertEquals(2, result.matches().getFirst().lineNumber());
        assertTrue(result.matches().getFirst().line().length() <= 302);
        assertTrue(result.truncated());
        assertThrows(ProjectWorkspace.WorkspaceException.class, () -> workspace.fingerprint(1L));
    }

    @Test
    void rejectsOversizedOrNonUtf8FilesWithoutChangingExistingContent() throws Exception {
        tools.createFile("a.ts", "safe", 1L);
        String hash = snapshot("a.ts").sha256();
        properties.setMaxFileBytes(6);
        assertFalse(tools.updateFile("a.ts", hash, "任务任务", 1L).success());
        assertEquals("safe", snapshot("a.ts").content());
        assertFalse(tools.createFile("nul.ts", "binary\0", 1L).success());

        Path root = workspace.projectRoot(1L);
        Files.write(root.resolve("binary.ts"), new byte[]{(byte) 0xC3, (byte) 0x28});
        assertFalse(tools.readFile("binary.ts", 1L).success());
        Files.writeString(root.resolve("big.ts"), "x".repeat(7));
        assertFalse(tools.readFile("big.ts", 1L).success());
    }

    @Test
    void concurrentUpdatesWithSameHashAllowOnlyOneWinner() throws Exception {
        tools.createFile("src/main.ts", "original", 1L);
        String hash = snapshot("src/main.ts").sha256();
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> {
                start.await();
                return tools.updateFile("src/main.ts", hash, "first", 1L).success();
            });
            var second = executor.submit(() -> {
                start.await();
                return tools.updateFile("src/main.ts", hash, "second", 1L).success();
            });
            start.countDown();
            assertNotEquals(first.get(), second.get());
        }
        assertTrue(List.of("first", "second").contains(snapshot("src/main.ts").content()));
    }

    @Test
    void fingerprintsAreDeterministicAndCopyCannotOverwriteOrNestWithinProject() {
        tools.createFile("z.ts", "last", 1L);
        tools.createFile("a.ts", "first", 1L);
        tools.createFile("a.ts", "first", 2L);
        tools.createFile("z.ts", "last", 2L);
        assertEquals(workspace.fingerprint(1L), workspace.fingerprint(2L));
        assertThrows(ProjectWorkspace.WorkspaceException.class,
                () -> workspace.copySource(1L, workspace.projectRoot(1L).resolve("copy")));
        assertThrows(ProjectWorkspace.WorkspaceException.class,
                () -> workspace.copySource(1L, workspace.projectRoot(2L)));
    }

    @Test
    void copiesAndFingerprintsBinaryStaticAssetsButDoesNotReadOrSearchThem() throws Exception {
        tools.createFile("src/main.ts", "needle", 1L);
        Path asset = workspace.projectRoot(1L).resolve("public/logo.png");
        Files.createDirectories(asset.getParent());
        byte[] binary = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0, (byte) 0xFF};
        Files.write(asset, binary);
        String fingerprint = workspace.fingerprint(1L);

        assertTrue(tools.listFiles(".", 1L).data().entries().stream()
                .anyMatch(node -> "public/logo.png".equals(node.path())));
        assertFalse(tools.readFile("public/logo.png", 1L).success());
        ProjectSearchResult search = tools.searchFiles("needle", 1L).data();
        assertEquals(1, search.matches().size());
        Path copy = temporaryDirectory.resolve("assets-snapshot");
        workspace.copySource(1L, copy);
        assertArrayEquals(binary, Files.readAllBytes(copy.resolve("public/logo.png")));

        Files.write(asset, new byte[]{1, 2, 3});
        assertNotEquals(fingerprint, workspace.fingerprint(1L));
    }

    @Test
    void deletedAppsRejectSubsequentOperationsWithoutRecreatingDirectories() {
        tools.createFile("src/main.ts", "old stream", 1L);
        workspace.markDeleted(1L);
        workspace.markDeleted(1L);
        assertTrue(workspace.isDeleted(1L));
        assertFalse(tools.createFile("src/new.ts", "late stream", 1L).success());
        assertFalse(tools.readFile("src/main.ts", 1L).success());
        assertFalse(tools.listFiles(".", 1L).success());
        assertThrows(ProjectWorkspace.WorkspaceException.class, () -> workspace.projectRoot(1L));
        assertThrows(ProjectWorkspace.WorkspaceException.class, () -> workspace.fingerprint(1L));
        assertThrows(ProjectWorkspace.WorkspaceException.class,
                () -> workspace.copySource(1L, temporaryDirectory.resolve("deleted-snapshot")));
        assertFalse(workspace.isDeleted(2L));
        assertTrue(tools.createFile("src/main.ts", "other app", 2L).success());
    }

    private ProjectFileSnapshot snapshot(String path) {
        ProjectToolResult<ProjectFileSnapshot> result = tools.readFile(path, 1L);
        assertTrue(result.success(), result.message());
        return result.data();
    }
}
