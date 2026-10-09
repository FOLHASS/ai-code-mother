package com.xy.aicodemother.ai.tools;

import com.xy.aicodemother.ai.tools.model.ProjectFileSnapshot;
import com.xy.aicodemother.config.ProjectToolProperties;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.channels.Channels;
import java.nio.channels.SeekableByteChannel;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * 工程工作空间：集中处理目录隔离、源码筛选、版本摘要和原子写入。
 *
 * <p>appId 来自工具调用上下文，不能由模型自行指定。沿用现有 Vue 工程目录
 * {@code vue_project_{appId}}。文件编辑工具只处理 UTF-8 源码；依赖目录、构建产物、
 * 隐藏文件、凭证文件和符号链接不参与读取、复制或摘要计算。
 * {@code package.json}、{@code package-lock.json} 和常见图片、字体资源都属于构建输入，
 * 会参与复制和版本摘要；二进制资源不能通过文本读取、搜索或修改工具编辑。</p>
 *
 * <p>锁在同一 JVM 内串行化同一应用的工具操作。锁引用结束后自动回收，
 * 部署为多个后端实例时应另行增加分布式锁或版本存储。</p>
 */
@Component
public class ProjectWorkspace {

    private static final Set<String> EXCLUDED_DIRECTORIES = Set.of(
            "node_modules", "dist", "build", "target", "coverage", "out", "vendor");
    private static final Set<String> SOURCE_EXTENSIONS = Set.of(
            "vue", "js", "mjs", "cjs", "jsx", "ts", "tsx", "json", "html", "css",
            "scss", "sass", "less", "md", "txt", "yml", "yaml", "xml", "svg", "svelte", "astro");
    private static final Set<String> ASSET_EXTENSIONS = Set.of(
            "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "woff", "woff2", "ttf", "otf", "eot");
    private static final int MAX_SCAN_ENTRIES = 20_000;
    private static final long MAX_SUPPORTED_FILE_BYTES = 16L * 1024 * 1024;
    private static final long MAX_PROJECT_BYTES = 64L * 1024 * 1024;

    private final ProjectToolProperties properties;
    private final ConcurrentHashMap<Long, LockEntry> projectLocks = new ConcurrentHashMap<>();
    private final Set<Long> deletedApps = ConcurrentHashMap.newKeySet();

    public ProjectWorkspace(ProjectToolProperties properties) {
        this.properties = properties;
    }

    /**
     * 返回服务端确定的工程根目录。该方法不会自动创建工程。
     */
    public Path projectRoot(Long appId) {
        requireAppId(appId);
        requireActiveApp(appId);
        try {
            Path configuredRoot = Path.of(properties.getWorkspaceRoot()).toAbsolutePath().normalize();
            // 先解析已存在的父目录，避免 macOS /var 等系统链接导致新建前后根路径发生变化。
            // 配置根目录由管理员指定，可解析它本身的链接；应用目录及其子目录禁止链接。
            Path existingParent = configuredRoot;
            while (existingParent != null && !Files.exists(existingParent)) {
                existingParent = existingParent.getParent();
            }
            if (existingParent == null) {
                throw new WorkspaceException("无法访问工程存储目录");
            }
            Path base = existingParent.toRealPath().resolve(existingParent.relativize(configuredRoot));
            Path root = base.resolve("vue_project_" + appId);
            checkNoSymbolicLinks(root, root);
            return root;
        } catch (IOException e) {
            throw new WorkspaceException("无法访问工程存储目录");
        }
    }

    /**
     * 在应用级锁中执行操作，保证同一进程内的版本检查与修改不会交错。
     */
    public <T> T withProjectLock(Long appId, Callable<T> operation) {
        requireAppId(appId);
        LockEntry entry = projectLocks.compute(appId, (id, previous) -> {
            LockEntry current = previous == null ? new LockEntry() : previous;
            current.references++;
            return current;
        });
        entry.lock.lock();
        try {
            // 排队期间应用可能被删除，拿到锁之后必须再次检查。
            requireActiveApp(appId);
            return operation.call();
        } catch (WorkspaceException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new WorkspaceException("工程操作已中断");
        } catch (Exception e) {
            // 文件系统异常经常含服务器绝对路径，不能直接回传给模型。
            throw new WorkspaceException("工程操作失败，请检查文件权限及工程状态");
        } finally {
            entry.lock.unlock();
            projectLocks.computeIfPresent(appId, (id, current) -> --current.references == 0 ? null : current);
        }
    }

    /**
     * 应用资源清理完成后标记删除，阻止已缓存的 AI 服务或排队工具再次创建工程。
     * 此标记用于当前 JVM 中尚未结束的调用；应用权限仍由业务入口和数据库校验。
     */
    public void markDeleted(Long appId) {
        requireAppId(appId);
        if (!isDeleted(appId)) {
            withProjectLock(appId, () -> {
                deletedApps.add(appId);
                return null;
            });
        }
    }

    /** 当前 JVM 是否已清理并关闭该应用的工作空间。 */
    public boolean isDeleted(Long appId) {
        return appId != null && deletedApps.contains(appId);
    }

    /**
     * 将工具相对路径解析到本应用内，并拒绝绝对路径、路径穿越、隐藏或禁止目录。
     * directory 为 true 时允许空路径或单独的点，表示工程根目录。
     */
    public Path resolve(Long appId, String relativePath, boolean directory) {
        Path root = projectRoot(appId);
        if (directory && (relativePath == null || relativePath.isBlank() || ".".equals(relativePath))) {
            return root;
        }
        if (relativePath == null || relativePath.isBlank() || relativePath.length() > 500
                || relativePath.indexOf('\\') >= 0 || relativePath.indexOf(':') >= 0
                || relativePath.chars().anyMatch(Character::isISOControl)) {
            throw new WorkspaceException("请提供有效的工程相对路径，使用 / 分隔目录");
        }
        Path relative = Path.of(relativePath);
        if (relative.isAbsolute()) {
            throw new WorkspaceException("不允许使用绝对路径");
        }
        for (Path component : relative) {
            String name = component.toString();
            if ("..".equals(name) || ".".equals(name) || !isAllowedName(name)) {
                throw new WorkspaceException("路径包含禁止访问的目录或文件");
            }
        }
        Path path = root.resolve(relative).normalize();
        if (!path.startsWith(root) || path.equals(root)) {
            throw new WorkspaceException("文件必须位于当前工程目录内");
        }
        if (!directory && !isTextSourceFile(path)) {
            throw new WorkspaceException("工具仅支持 UTF-8 源码文件，不支持二进制或凭证文件");
        }
        checkNoSymbolicLinks(root, path);
        return path;
    }

    /**
     * 递归扫描允许的目录、源码和静态资源，不跟随符号链接，返回工程相对路径顺序。
     * 扫描本身有硬上限，避免依赖文件或异常工程耗尽资源。
     */
    public List<Path> sourceEntries(Long appId, Path directory) throws IOException {
        Path root = projectRoot(appId);
        checkNoSymbolicLinks(root, directory);
        if (!Files.isDirectory(directory, LinkOption.NOFOLLOW_LINKS)) {
            throw new WorkspaceException("工程目录不存在，请先创建工程文件");
        }
        List<Path> entries = new ArrayList<>();
        Files.walkFileTree(directory, new SimpleFileVisitor<>() {
            private int visited;

            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                if (!dir.equals(directory) && !isAllowedName(dir.getFileName().toString())) {
                    return FileVisitResult.SKIP_SUBTREE;
                }
                checkVisitLimit();
                if (!dir.equals(directory)) {
                    entries.add(dir);
                }
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                if (!isAllowedName(file.getFileName().toString())) {
                    return FileVisitResult.CONTINUE;
                }
                checkVisitLimit();
                if (attrs.isSymbolicLink()) {
                    throw new WorkspaceException("工程包含符号链接，请移除后重试");
                }
                if (attrs.isRegularFile() && isBuildInputFile(file)) {
                    entries.add(file);
                }
                return FileVisitResult.CONTINUE;
            }

            private void checkVisitLimit() {
                if (++visited > MAX_SCAN_ENTRIES) {
                    throw new WorkspaceException("工程文件数量过多，请缩小操作范围");
                }
            }
        });
        entries.sort(Comparator.comparing(path -> relativePath(root, path)));
        return entries;
    }

    /**
     * 读取经过大小和 UTF-8 校验的文件快照，不跟随末级符号链接。
     */
    public ProjectFileSnapshot readSnapshot(Long appId, Path path) throws IOException {
        Path root = projectRoot(appId);
        // 公开的工作空间读取方法也执行路径白名单，不能绕过工具入口读取隐藏文件。
        path = resolve(appId, relativePath(root, path), false);
        byte[] bytes = readInputBytes(appId, path);
        String content;
        try {
            content = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException e) {
            throw new WorkspaceException("文件不是有效的 UTF-8 文本");
        }
        if (content.indexOf('\0') >= 0) {
            throw new WorkspaceException("文件含二进制内容，不能通过源码工具处理");
        }
        return new ProjectFileSnapshot(relativePath(root, path), content, sha256(bytes), bytes.length);
    }

    /**
     * 将文本转为有效的 UTF-8 字节，并应用与读取相同的大小限制。
     */
    public byte[] encodeContent(String content) {
        if (content == null || content.indexOf('\0') >= 0 || content.length() > maxFileBytes()) {
            throw new WorkspaceException("文件内容为 null、包含二进制字符或超过大小限制");
        }
        try {
            ByteBuffer encoded = StandardCharsets.UTF_8.newEncoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .encode(java.nio.CharBuffer.wrap(content));
            if (encoded.remaining() > maxFileBytes()) {
                throw new WorkspaceException("文件超过允许的大小限制");
            }
            byte[] result = new byte[encoded.remaining()];
            encoded.get(result);
            return result;
        } catch (CharacterCodingException e) {
            throw new WorkspaceException("文件内容不是有效的 UTF-8 文本");
        }
    }

    /**
     * 在同目录创建临时文件后替换目标。更新必须由文件系统原子移动；
     * 新建使用不覆盖的移动方式，已有文件永远不会被 create_file 覆盖。
     * 调用方必须持有应用锁并在更新前检查文件哈希。
     */
    public void writeFile(Long appId, Path target, byte[] content, boolean create) throws IOException {
        Path root = projectRoot(appId);
        target = resolve(appId, relativePath(root, target), false);
        Files.createDirectories(target.getParent());
        checkNoSymbolicLinks(root, target);
        if (create && Files.exists(target, LinkOption.NOFOLLOW_LINKS)) {
            throw new WorkspaceException("文件已存在，请先 read_file 再使用 update_file");
        }
        Path temporary = Files.createTempFile(target.getParent(), ".tool-write-", ".tmp");
        try {
            Files.write(temporary, content, StandardOpenOption.TRUNCATE_EXISTING);
            if (create) {
                Files.move(temporary, target);
            } else {
                Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (AtomicMoveNotSupportedException e) {
            throw new WorkspaceException("当前文件系统不支持原子更新，原文件未修改");
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    /**
     * 对允许的源码和图片、字体资源按相对路径排序，计算内容哈希组成的工程指纹。
     * 构建与发布可据此检查是否仍对应同一份源码，空目录不影响指纹。
     */
    public String fingerprint(Long appId) {
        return withProjectLock(appId, () -> {
            Path root = projectRoot(appId);
            MessageDigest digest = digest();
            for (Path source : sourceFiles(appId)) {
                digest.update(relativePath(root, source).getBytes(StandardCharsets.UTF_8));
                digest.update((byte) 0);
                digest.update(sha256(readInputBytes(appId, source)).getBytes(StandardCharsets.UTF_8));
                digest.update((byte) '\n');
            }
            return HexFormat.of().formatHex(digest.digest());
        });
    }

    /**
     * 原样复制源码和静态资源到由后端提供的新目录，二进制内容不会经由文本解码。
     * 不复制依赖、构建目录、隐藏文件或凭证，累计内容上限为 64 MiB。
     * 目标目录不能位于源码工程内，也不能已存在或包含文件。
     */
    public void copySource(Long appId, Path destination) {
        withProjectLock(appId, () -> {
            Path root = projectRoot(appId);
            Path target = destination.toAbsolutePath().normalize();
            if (target.startsWith(root) || Files.exists(target, LinkOption.NOFOLLOW_LINKS)) {
                throw new WorkspaceException("源码副本必须使用工程外的新目录");
            }
            Files.createDirectories(target);
            for (Path source : sourceFiles(appId)) {
                Path copy = target.resolve(relativePath(root, source));
                Files.createDirectories(copy.getParent());
                Files.write(copy, readInputBytes(appId, source), StandardOpenOption.CREATE_NEW);
            }
            return null;
        });
    }

    /**
     * 返回构建输入清单并限制文件数量、累计 64 MiB；构建不能使用截断清单。
     */
    public List<Path> sourceFiles(Long appId) throws IOException {
        List<Path> files = sourceEntries(appId, projectRoot(appId)).stream()
                .filter(path -> Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)).toList();
        if (files.size() > maxListEntries()) {
            throw new WorkspaceException("工程源码文件数量超过限制");
        }
        long totalBytes = 0;
        for (Path file : files) {
            long bytes = Files.size(file);
            if (bytes > maxFileBytes()) {
                throw new WorkspaceException("工程包含超过大小限制的文件");
            }
            totalBytes += bytes;
            if (totalBytes > MAX_PROJECT_BYTES) {
                throw new WorkspaceException("工程构建输入累计超过 64 MiB 限制");
            }
        }
        return files;
    }

    public int maxListEntries() {
        return Math.max(1, Math.min(properties.getMaxListEntries(), MAX_SCAN_ENTRIES));
    }

    public int maxSearchResults() {
        return Math.max(1, Math.min(properties.getMaxSearchResults(), 1_000));
    }

    public static String relativePath(Path root, Path file) {
        return root.relativize(file).toString().replace('\\', '/');
    }

    public static String sha256(byte[] bytes) {
        return HexFormat.of().formatHex(digest().digest(bytes));
    }

    private long maxFileBytes() {
        return Math.max(1, Math.min(properties.getMaxFileBytes(), MAX_SUPPORTED_FILE_BYTES));
    }

    private static boolean isAllowedName(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        return !name.startsWith(".") && !EXCLUDED_DIRECTORIES.contains(lower)
                && !Set.of("credentials.json", "secrets.json", "id_rsa", "id_ed25519").contains(lower);
    }

    /** 是否为文本源码；搜索工具用此判断跳过图片、字体等二进制资源。 */
    public static boolean isTextSourceFile(Path path) {
        String name = path.getFileName().toString();
        if (!isAllowedName(name)) {
            return false;
        }
        int dot = name.lastIndexOf('.');
        return dot >= 0 && SOURCE_EXTENSIONS.contains(name.substring(dot + 1).toLowerCase(Locale.ROOT));
    }

    private static boolean isBuildInputFile(Path path) {
        String name = path.getFileName().toString();
        int dot = name.lastIndexOf('.');
        return isTextSourceFile(path) || (isAllowedName(name) && dot >= 0
                && ASSET_EXTENSIONS.contains(name.substring(dot + 1).toLowerCase(Locale.ROOT)));
    }

    private byte[] readInputBytes(Long appId, Path path) throws IOException {
        Path root = projectRoot(appId);
        checkNoSymbolicLinks(root, path);
        for (Path component : root.relativize(path)) {
            if (!isAllowedName(component.toString())) {
                throw new WorkspaceException("路径包含禁止访问的目录或文件");
            }
        }
        if (!isBuildInputFile(path) || !Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
            throw new WorkspaceException("构建输入不存在或不是允许的普通文件");
        }
        long maximum = maxFileBytes();
        if (Files.size(path) > maximum) {
            throw new WorkspaceException("文件超过允许的大小限制");
        }
        try (SeekableByteChannel channel = Files.newByteChannel(path,
                Set.of(StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS));
             InputStream input = Channels.newInputStream(channel)) {
            byte[] bytes = input.readNBytes((int) maximum + 1);
            if (bytes.length > maximum) {
                throw new WorkspaceException("文件超过允许的大小限制");
            }
            return bytes;
        }
    }

    private static void requireAppId(Long appId) {
        if (appId == null || appId <= 0) {
            throw new WorkspaceException("缺少有效的应用上下文");
        }
    }

    private void requireActiveApp(Long appId) {
        if (isDeleted(appId)) {
            throw new WorkspaceException("应用已删除，不能继续操作工程");
        }
    }

    private static void checkNoSymbolicLinks(Path root, Path target) {
        if (!target.startsWith(root)) {
            throw new WorkspaceException("文件必须位于当前工程目录内");
        }
        Path current = root;
        if (Files.isSymbolicLink(current)) {
            throw new WorkspaceException("不允许访问符号链接");
        }
        for (Path component : root.relativize(target)) {
            current = current.resolve(component);
            if (Files.isSymbolicLink(current)) {
                throw new WorkspaceException("不允许访问符号链接");
            }
        }
    }

    private static MessageDigest digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("运行环境缺少 SHA-256 支持", e);
        }
    }

    private static final class LockEntry {
        private final ReentrantLock lock = new ReentrantLock();
        private int references;
    }

    /**
     * 对模型可见的业务错误，不包含底层文件系统异常和服务器路径。
     */
    public static class WorkspaceException extends RuntimeException {
        public WorkspaceException(String message) {
            super(message);
        }
    }
}
