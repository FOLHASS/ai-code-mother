package com.xy.aicodemother.core.handler;

import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.xy.aicodemother.ai.model.*;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.model.enums.ChatHistoryMessageTypeEnum;
import com.xy.aicodemother.service.ChatHistoryService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * JSON 消息流处理器
 * 处理 VUE_PROJECT 类型的复杂流式响应，包含工具调用信息
 */
@Slf4j
@Component
public class JsonMessageStreamHandler {

    private static final int MAX_DISPLAY_ITEMS = 20;
    private static final int MAX_CODE_CHARS = 8000;
    private static final Pattern BACKTICKS = Pattern.compile("`+");

    /**
     * 处理 TokenStream（VUE_PROJECT）
     * 解析 JSON 消息并重组为完整的响应格式
     *
     * @param originFlux         原始流
     * @param chatHistoryService 聊天历史服务
     * @param appId              应用ID
     * @param loginUser          登录用户
     * @return 处理后的流
     */
    public Flux<String> handle(Flux<String> originFlux,
                               ChatHistoryService chatHistoryService,
                               long appId, User loginUser) {
        // 收集数据用于生成后端记忆格式
        StringBuilder chatHistoryStringBuilder = new StringBuilder();
        // 用于跟踪已经见过的工具ID，判断是否是第一次调用
        Set<String> seenToolIds = new HashSet<>();
        return originFlux
                .map(chunk -> {
                    // 解析每个 JSON 消息块
                    return handleJsonMessageChunk(chunk, chatHistoryStringBuilder, seenToolIds);
                })
                .filter(StrUtil::isNotEmpty) // 过滤空字串
                .doOnComplete(() -> {
                    // 流式响应完成后，添加 AI 消息到对话历史
                    String aiResponse = chatHistoryStringBuilder.toString();
                    chatHistoryService.addChatHistory(appId, aiResponse, ChatHistoryMessageTypeEnum.AI.getValue(), loginUser.getId());
                })
                .doOnError(error -> {
                    // 如果AI回复失败，也要记录错误消息
                    String errorMessage = "AI回复失败: " + error.getMessage();
                    chatHistoryService.addChatHistory(appId, errorMessage, ChatHistoryMessageTypeEnum.AI.getValue(), loginUser.getId());
                });
    }

    /**
     * 解析并收集 TokenStream 数据
     */
    private String handleJsonMessageChunk(String chunk, StringBuilder chatHistoryStringBuilder, Set<String> seenToolIds) {
        // 解析 JSON
        StreamMessage streamMessage = JSONUtil.toBean(chunk, StreamMessage.class);
        StreamMessageTypeEnum typeEnum = StreamMessageTypeEnum.getEnumByValue(streamMessage.getType());
        switch (typeEnum) {
            case AI_RESPONSE -> {
                AiResponseMessage aiMessage = JSONUtil.toBean(chunk, AiResponseMessage.class);
                String data = aiMessage.getData();
                // 直接拼接响应
                chatHistoryStringBuilder.append(data);
                return data;
            }
            case TOOL_REQUEST -> {
                ToolRequestMessage toolRequestMessage = JSONUtil.toBean(chunk, ToolRequestMessage.class);
                String toolId = toolRequestMessage.getToolId();
                // 检查是否是第一次看到这个工具 ID
                if (toolId != null && !seenToolIds.contains(toolId)) {
                    seenToolIds.add(toolId);
                    return "\n\n> 🛠️ 正在" + toolDisplayName(toolRequestMessage.getToolName()) + "…\n\n";
                } else {
                    // 不是第一次调用这个工具，直接返回空
                    return "";
                }
            }
            case TOOL_EXECUTED -> {
                ToolExecutedMessage toolExecutedMessage = JSONUtil.toBean(chunk, ToolExecutedMessage.class);
                String result = formatToolExecutedMessage(toolExecutedMessage);
                // 输出前端和要持久化的内容
                String output = String.format("\n\n%s\n\n", result);
                chatHistoryStringBuilder.append(output);
                return output;
            }
            default -> {
                log.error("不支持的消息类型: {}", typeEnum);
                return "";
            }
        }
    }

    /** 按真实工具返回值展示，调用结束不代表执行成功；失败时不展示待写入的代码。 */
    private String formatToolExecutedMessage(ToolExecutedMessage message) {
        String name = StrUtil.blankToDefault(message.getName(), "未知工具");
        JSONObject result = parseObject(message.getResult());
        JSONObject arguments = parseObject(message.getArguments());
        if (Boolean.FALSE.equals(result.get("success"))) {
            String reason = StrUtil.blankToDefault(result.getStr("message"), "请检查参数后重试");
            return "### ❌ 工具执行失败\n\n**操作：** " + toolDisplayName(name)
                    + "\n\n> " + reason.replace("\n", "\n> ");
        }
        // 兼容其他工具的普通文本结果，以及缺少 success 标识的结果。
        if (!Boolean.TRUE.equals(result.get("success"))) {
            return "### 🛠️ 工具执行结果\n\n**工具：** " + inlineCode(name)
                    + "\n\n" + codeBlock(message.getResult(), "text");
        }
        JSONObject data = result.get("data") instanceof JSONObject object ? object : new JSONObject();
        String path = StrUtil.blankToDefault(data.getStr("path"),
                StrUtil.blankToDefault(arguments.getStr("path"), "未提供文件路径"));
        String fileInfo = "**文件：** " + inlineCode(path) + " · **大小：** "
                + FileUtil.readableFileSize(data.getLong("sizeBytes", 0L)) + "\n\n";
        String language = StrUtil.blankToDefault(FileUtil.getSuffix(path), "text");
        if ("vue".equalsIgnoreCase(language)) {
            language = "html";
        }
        return switch (name) {
            case "list_files" -> formatDirectory(data, arguments);
            case "read_file" -> "### 📖 文件读取完成\n\n" + fileInfo
                    + codeBlock(data.getStr("content"), language);
            case "search_files" -> formatSearch(data, arguments);
            case "create_file" -> "### ✨ 文件创建完成\n\n" + fileInfo
                    + codeBlock(arguments.getStr("content"), language);
            case "update_file" -> "### 📝 文件更新完成\n\n" + fileInfo
                    + codeBlock(arguments.getStr("content"), language);
            case "apply_patch" -> "### 🩹 文件修改完成\n\n" + fileInfo
                    + "**修改前**\n\n" + codeBlock(arguments.getStr("oldText"), language)
                    + "\n\n**修改后**\n\n" + (StrUtil.isEmpty(arguments.getStr("newText"))
                    ? "> 已删除该片段。" : codeBlock(arguments.getStr("newText"), language));
            case "delete_file" -> "### 🗑️ 文件删除完成\n\n**文件：** " + inlineCode(path)
                    + "\n\n> 已从工程中删除。";
            default -> "### 🛠️ 工具执行结果\n\n**工具：** " + inlineCode(name)
                    + "\n\n" + codeBlock(message.getResult(), "text");
        };
    }

    /** 目录和搜索结果只展开有限条目，避免一次工具调用占满对话区域。 */
    private String formatDirectory(JSONObject data, JSONObject arguments) {
        String directory = StrUtil.blankToDefault(data.getStr("directory"),
                StrUtil.blankToDefault(arguments.getStr("directory"), "."));
        JSONArray entries = data.getJSONArray("entries");
        if (entries == null) {
            entries = new JSONArray();
        }
        StringBuilder listing = new StringBuilder();
        for (int i = 0; i < Math.min(entries.size(), MAX_DISPLAY_ITEMS); i++) {
            JSONObject entry = entries.getJSONObject(i);
            boolean isDirectory = "directory".equals(entry.getStr("type"));
            listing.append(isDirectory ? "📁 " : "📄 ").append(entry.getStr("path", "未提供路径"));
            if (isDirectory) {
                listing.append('/');
            } else {
                listing.append("  (").append(FileUtil.readableFileSize(entry.getLong("sizeBytes", 0L))).append(')');
            }
            listing.append('\n');
        }
        return "### 📂 目录读取完成\n\n**目录：** " + inlineCode(directory)
                + " · **返回 " + entries.size() + " 项**\n\n"
                + (entries.isEmpty() ? "> 当前目录没有可展示的文件。" : codeBlock(listing.toString(), "text"))
                + truncationNote(entries.size() > MAX_DISPLAY_ITEMS || data.getBool("truncated", false));
    }

    private String formatSearch(JSONObject data, JSONObject arguments) {
        JSONArray matches = data.getJSONArray("matches");
        if (matches == null) {
            matches = new JSONArray();
        }
        StringBuilder hits = new StringBuilder();
        for (int i = 0; i < Math.min(matches.size(), MAX_DISPLAY_ITEMS); i++) {
            JSONObject hit = matches.getJSONObject(i);
            hits.append(hit.getStr("path", "未提供路径")).append(':')
                    .append(hit.getInt("lineNumber", 0)).append('\n')
                    .append("  ").append(hit.getStr("line", "")).append("\n\n");
        }
        return "### 🔎 搜索完成\n\n**关键词：** "
                + inlineCode(StrUtil.blankToDefault(arguments.getStr("query"), "未提供关键词"))
                + " · **匹配 " + matches.size() + " 处**\n\n"
                + (matches.isEmpty() ? "> 未找到匹配内容。" : codeBlock(hits.toString(), "text"))
                + truncationNote(matches.size() > MAX_DISPLAY_ITEMS || data.getBool("truncated", false));
    }

    private String truncationNote(boolean truncated) {
        return truncated ? "\n\n> 结果较多，仅展示部分内容，可缩小查询范围继续查看。" : "";
    }

    private String toolDisplayName(String name) {
        return switch (StrUtil.blankToDefault(name, "未知工具")) {
            case "list_files" -> "读取目录";
            case "read_file" -> "读取文件";
            case "search_files" -> "搜索代码";
            case "create_file" -> "创建文件";
            case "update_file" -> "更新文件";
            case "apply_patch" -> "修改文件";
            case "delete_file" -> "删除文件";
            default -> "调用工具 " + inlineCode(StrUtil.blankToDefault(name, "未知工具"));
        };
    }

    private JSONObject parseObject(String value) {
        try {
            return StrUtil.isBlank(value) ? new JSONObject() : JSONUtil.parseObj(value);
        } catch (RuntimeException ignored) {
            // 展示层兼容非 JSON 返回，不能因格式化失败中断整个生成流程。
            return new JSONObject();
        }
    }

    /** 动态加长围栏，防止源码中的 Markdown 代码块提前结束外层代码展示。 */
    private String codeBlock(String content, String language) {
        if (StrUtil.isEmpty(content)) {
            return "> 暂无内容。";
        }
        boolean truncated = content.length() > MAX_CODE_CHARS;
        String preview = truncated ? content.substring(0, MAX_CODE_CHARS) : content;
        String fence = "`".repeat(Math.max(3, maxBackticks(preview) + 1));
        String output = fence + language + "\n" + preview + "\n" + fence;
        return truncated ? output + "\n\n> 内容较长，仅展示前 " + MAX_CODE_CHARS + " 个字符。" : output;
    }

    private String inlineCode(String text) {
        String value = text.replace('\n', ' ').replace('\r', ' ');
        String fence = "`".repeat(maxBackticks(value) + 1);
        return fence + " " + value + " " + fence;
    }

    private int maxBackticks(String text) {
        var matcher = BACKTICKS.matcher(text);
        int maximum = 0;
        while (matcher.find()) {
            maximum = Math.max(maximum, matcher.group().length());
        }
        return maximum;
    }
}
