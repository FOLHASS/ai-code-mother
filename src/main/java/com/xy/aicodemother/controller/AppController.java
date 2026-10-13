package com.xy.aicodemother.controller;

import cn.hutool.json.JSONUtil;
import com.mybatisflex.core.paginate.Page;
import com.xy.aicodemother.annotation.AuthCheck;
import com.xy.aicodemother.common.BaseResponse;
import com.xy.aicodemother.common.DeleteRequest;
import com.xy.aicodemother.common.ResultUtils;
import com.xy.aicodemother.constant.AppConstant;
import com.xy.aicodemother.constant.UserConstant;
import com.xy.aicodemother.exception.BusinessException;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.exception.ThrowUtils;
import com.xy.aicodemother.model.dto.app.AppAddRequest;
import com.xy.aicodemother.model.dto.app.AppAdminUpdateRequest;
import com.xy.aicodemother.model.dto.app.AppQueryRequest;
import com.xy.aicodemother.model.dto.app.AppUpdateRequest;
import com.xy.aicodemother.model.entity.App;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;
import com.xy.aicodemother.model.vo.AppVO;
import com.xy.aicodemother.service.AppService;
import com.xy.aicodemother.service.DownloadService;
import com.xy.aicodemother.service.UserService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.javassist.compiler.CodeGen;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.io.File;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 应用控制层。
 *
 * <p>Controller 只负责四件事：接收 HTTP 请求、读取当前登录用户、
 * 声明管理员权限要求，以及包装统一响应。应用归属校验、参数校验、
 * 分页查询和更新删除等业务逻辑全部由 AppService 处理，避免控制层变厚。</p>
 */
@RestController
@RequestMapping("/app")
@Slf4j
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

    @Autowired
    @Resource
    private DownloadService downloadService;


    @GetMapping(value = "/chat/gen/code", produces = "text/event-stream")
    public Flux<ServerSentEvent<String>> chatToGenCode(@RequestParam Long appId,
                                               @RequestParam String message,
                                               HttpServletRequest request) {
        User loginUser = userService.getLoginUser(request);

        // 对流当中的每一块数据进行包装， 防止数据传输过程当中的空行丢失，影响前端渲染
        // 实现的两种方式：
        // 1. 使用json对象进行包装传输 2. 对字符串进行哈希加密，然后前端解密
        return appService.chatToGenCode(appId, message, loginUser)
                .map(chunk -> {
                    Map<String, String> wrapper = Map.of("d", chunk);
                    String jsonStr = JSONUtil.toJsonStr(wrapper);
                    return ServerSentEvent.<String>builder().data(jsonStr).build();
                })
                .concatWith(Mono.just(
                        ServerSentEvent.<String>builder().event("done").data("").build()
                ))
                .onErrorResume(error -> {
                    log.error("应用生成失败，appId={}", appId, error);
                    String errorMessage = error instanceof BusinessException && error.getMessage() != null
                            ? error.getMessage() : "代码生成失败，请稍后重试";
                    return Mono.just(ServerSentEvent.<String>builder().event("error")
                            .data(JSONUtil.toJsonStr(Map.of("message", errorMessage))).build());
                });
    }


    @PostMapping("deploy")
    public BaseResponse<String> deploy(@RequestParam Long appId,
                                      HttpServletRequest request) {
        ThrowUtils.throwIf(appId == null || appId <= 0, ErrorCode.PARAMS_ERROR, "应用 id 不合法");
        User loginUser = userService.getLoginUser(request);
        return ResultUtils.success(appService.deployApp(appId, loginUser));
    }


    @GetMapping("/download/{appId}")   // 请求头是为了拿到用户信息， 响应是为了封装下载请求
    public void downloadAppCode(@PathVariable Long appId, HttpServletRequest request, HttpServletResponse response) {
        // 1. 校验参数
        ThrowUtils.throwIf(appId == null || appId <= 0, ErrorCode.PARAMS_ERROR, "应用 id 不合法");
        // 2. 校验应用信息
        App app = appService.getById(appId);
        ThrowUtils.throwIf(app == null, ErrorCode.NOT_FOUND_ERROR, "应用不存在");
        // 3. 校验权限： 只有拥有者才能下载自己的代码
        User loginUser = userService.getLoginUser(request);
        ThrowUtils.throwIf(!app.getUserId().equals(loginUser.getId()), ErrorCode.NO_AUTH_ERROR, "无权限访问");
        // 4. 下载代码
        String rootPath = AppConstant.CODE_OUTPUT_ROOT_DIR + File.separator +  app.getCodeGenType()  + "_" + app.getId();
        downloadService.downloadCodeAsZip(rootPath, app.getAppName(), response);
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
     * 登录用户只读查看应用详情。
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
