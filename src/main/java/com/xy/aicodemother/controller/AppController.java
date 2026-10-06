package com.xy.aicodemother.controller;

import com.mybatisflex.core.paginate.Page;
import com.xy.aicodemother.annotation.AuthCheck;
import com.xy.aicodemother.common.BaseResponse;
import com.xy.aicodemother.common.DeleteRequest;
import com.xy.aicodemother.common.ResultUtils;
import com.xy.aicodemother.constant.UserConstant;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.exception.ThrowUtils;
import com.xy.aicodemother.model.dto.app.AppAddRequest;
import com.xy.aicodemother.model.dto.app.AppAdminUpdateRequest;
import com.xy.aicodemother.model.dto.app.AppQueryRequest;
import com.xy.aicodemother.model.dto.app.AppUpdateRequest;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.model.vo.AppVO;
import com.xy.aicodemother.service.AppService;
import com.xy.aicodemother.service.UserService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

/**
 * 应用控制层。
 *
 * <p>Controller 只负责四件事：接收 HTTP 请求、读取当前登录用户、
 * 声明管理员权限要求，以及包装统一响应。应用归属校验、参数校验、
 * 分页查询和更新删除等业务逻辑全部由 AppService 处理，避免控制层变厚。</p>
 */
@RestController
@RequestMapping("/app")
public class AppController {

    /**
     * 应用业务服务。
     */
    @Resource
    private AppService appService;

    /**
     * 用户服务，用于从 Session 中读取当前登录用户。
     */
    @Resource
    private UserService userService;


    @GetMapping("/chat/gen/code")
    public Flux<ServerSentEvent<String>> chatToGenCode(@RequestParam Long appId,
                                                       @RequestParam String message,
                                                       HttpServletRequest request) {
        User loginUser = userService.getLoginUser(request);
        return appService.chatToGenCode(appId, message, loginUser);
    }


    @PostMapping("deploy")
    public BaseResponse<String> deploy(@RequestParam Long appId,
                                      HttpServletRequest request) {
        ThrowUtils.throwIf(appId == null || appId <= 0, ErrorCode.PARAMS_ERROR, "应用 id 不合法");
        User loginUser = userService.getLoginUser(request);
        return ResultUtils.success(appService.deployApp(appId, loginUser));
    }

    /**
     * 用户创建应用。
     *
     * @param appAddRequest 创建请求，必须包含 initPrompt
     * @param request       当前 HTTP 请求
     * @return 新应用 id
     */
    @PostMapping("/add")
    public BaseResponse<Long> addApp(@RequestBody AppAddRequest appAddRequest,
                                    HttpServletRequest request) {
        User loginUser = userService.getLoginUser(request);
        return ResultUtils.success(appService.createApp(appAddRequest, loginUser));
    }

    /**
     * 用户修改自己的应用名称。
     */
    @PostMapping("/update")
    public BaseResponse<Boolean> updateApp(@RequestBody AppUpdateRequest appUpdateRequest,
                                          HttpServletRequest request) {
        User loginUser = userService.getLoginUser(request);
        return ResultUtils.success(appService.updateApp(appUpdateRequest, loginUser));
    }

    /**
     * 用户删除自己的应用。
     */
    @PostMapping("/delete")
    public BaseResponse<Boolean> deleteApp(@RequestBody DeleteRequest deleteRequest,
                                          HttpServletRequest request) {
        User loginUser = userService.getLoginUser(request);
        Long appId = deleteRequest == null ? null : deleteRequest.getId();
        return ResultUtils.success(appService.deleteApp(appId, loginUser));
    }

    /**
     * 用户查看自己创建的应用详情。
     */
    @GetMapping("/get/vo")
    public BaseResponse<AppVO> getAppVOById(@RequestParam("id") Long id,
                                           HttpServletRequest request) {
        User loginUser = userService.getLoginUser(request);
        return ResultUtils.success(appService.getAppVOById(id, loginUser));
    }

    /**
     * 用户分页查询自己的应用。
     */
    @PostMapping("/my/list/page/vo")
    public BaseResponse<Page<AppVO>> listMyAppVOByPage(@RequestBody AppQueryRequest appQueryRequest,
                                                     HttpServletRequest request) {
        User loginUser = userService.getLoginUser(request);
        return ResultUtils.success(appService.listMyAppVOByPage(appQueryRequest, loginUser));
    }

    /**
     * 分页查询精选应用。
     */
    @PostMapping("/good/list/page/vo")
    public BaseResponse<Page<AppVO>> listGoodAppVOByPage(@RequestBody AppQueryRequest appQueryRequest) {
        return ResultUtils.success(appService.listGoodAppVOByPage(appQueryRequest));
    }

    /**
     * 管理员删除任意应用。
     *
     * <p>管理员权限由 AuthCheck 切面完成，删除业务由 AppService 完成。</p>
     */
    @PostMapping("/admin/delete")
    @AuthCheck(mustRole = UserConstant.ADMIN_ROLE)
    public BaseResponse<Boolean> adminDeleteApp(@RequestBody DeleteRequest deleteRequest) {
        Long appId = deleteRequest == null ? null : deleteRequest.getId();
        return ResultUtils.success(appService.adminDeleteApp(appId));
    }

    /**
     * 管理员更新任意应用的名称、封面和优先级。
     */
    @PostMapping("/admin/update")
    @AuthCheck(mustRole = UserConstant.ADMIN_ROLE)
    public BaseResponse<Boolean> adminUpdateApp(@RequestBody AppAdminUpdateRequest request) {
        return ResultUtils.success(appService.adminUpdateApp(request));
    }

    /**
     * 管理员分页查询应用列表。
     */
    @PostMapping("/admin/list/page/vo")
    @AuthCheck(mustRole = UserConstant.ADMIN_ROLE)
    public BaseResponse<Page<AppVO>> adminListAppVOByPage(@RequestBody AppQueryRequest appQueryRequest) {
        return ResultUtils.success(appService.adminListAppVOByPage(appQueryRequest));
    }

    /**
     * 管理员查看任意应用详情。
     */
    @GetMapping("/admin/get/vo")
    @AuthCheck(mustRole = UserConstant.ADMIN_ROLE)
    public BaseResponse<AppVO> adminGetAppVOById(@RequestParam("id") Long id) {
        return ResultUtils.success(appService.adminGetAppVOById(id));
    }
}
