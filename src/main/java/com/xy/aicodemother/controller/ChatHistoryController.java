package com.xy.aicodemother.controller;

import com.mybatisflex.core.paginate.Page;
import com.xy.aicodemother.annotation.AuthCheck;
import com.xy.aicodemother.common.BaseResponse;
import com.xy.aicodemother.common.ResultUtils;
import com.xy.aicodemother.constant.UserConstant;
import com.xy.aicodemother.model.dto.chatHistory.ChatHistoryAppQueryRequest;
import com.xy.aicodemother.model.dto.chatHistory.ChatHistoryQueryRequest;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.model.vo.ChatHistoryVO;
import com.xy.aicodemother.service.ChatHistoryService;
import com.xy.aicodemother.service.UserService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 对话历史控制层。消息写入由应用生成流程完成，不开放直接修改历史的接口。
 */
@RestController
@RequestMapping("/chatHistory")
public class ChatHistoryController {

    @Resource
    private ChatHistoryService chatHistoryService;

    @Resource
    private UserService userService;

    /**
     * 应用创建者或管理员加载最新消息，或通过游标加载更早的消息。
     */
    @PostMapping("/app/list/page")
    public BaseResponse<Page<ChatHistoryVO>> listAppChatHistoryByPage(
            @RequestBody ChatHistoryAppQueryRequest queryRequest, HttpServletRequest request) {
        User loginUser = userService.getLoginUser(request);
        return ResultUtils.success(chatHistoryService.listAppChatHistoryByPage(queryRequest, loginUser));
    }

    /**
     * 管理员分页查看所有应用的对话历史。
     */
    @PostMapping("/admin/list/page")
    @AuthCheck(mustRole = UserConstant.ADMIN_ROLE)
    public BaseResponse<Page<ChatHistoryVO>> adminListChatHistoryByPage(
            @RequestBody ChatHistoryQueryRequest queryRequest, HttpServletRequest request) {
        User loginUser = userService.getLoginUser(request);
        return ResultUtils.success(chatHistoryService.adminListChatHistoryByPage(queryRequest, loginUser));
    }
}
