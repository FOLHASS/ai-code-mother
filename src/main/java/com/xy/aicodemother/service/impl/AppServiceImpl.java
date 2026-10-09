package com.xy.aicodemother.service.impl;

import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.RandomUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.json.JSONUtil;
import com.mybatisflex.core.paginate.Page;
import com.mybatisflex.core.query.QueryWrapper;
import com.mybatisflex.spring.service.impl.ServiceImpl;
import com.xy.aicodemother.constant.AppConstant;
import com.xy.aicodemother.ai.tools.ProjectBuildService;
import com.xy.aicodemother.core.AiCodeGeneratorFacade;
import com.xy.aicodemother.exception.BusinessException;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.exception.ThrowUtils;
import com.xy.aicodemother.mapper.AppMapper;
import com.xy.aicodemother.model.dto.app.AppAddRequest;
import com.xy.aicodemother.model.dto.app.AppAdminUpdateRequest;
import com.xy.aicodemother.model.dto.app.AppQueryRequest;
import com.xy.aicodemother.model.dto.app.AppUpdateRequest;
import com.xy.aicodemother.model.entity.App;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;
import com.xy.aicodemother.model.enums.ChatHistoryMessageTypeEnum;
import com.xy.aicodemother.model.vo.AppVO;
import com.xy.aicodemother.model.vo.UserVO;
import com.xy.aicodemother.service.AppService;
import com.xy.aicodemother.service.ChatHistoryService;
import com.xy.aicodemother.service.UserService;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.io.File;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 应用服务实现。
 *
 * <p>这里集中处理应用的业务规则：创建时补齐系统字段，普通用户操作时
 * 校验应用归属，分页查询时限制普通用户 pageSize，并将实体转换成脱敏 VO。</p>
 */
@Service
@Slf4j
public class AppServiceImpl extends ServiceImpl<AppMapper, App> implements AppService {

    /**
     * 用户服务用于查询当前应用的创建者，并生成脱敏用户信息。
     */
    @Resource
    private UserService userService;
    @Resource
    private AiCodeGeneratorFacade aiCodeGeneratorFacade;
    @Resource
    private ChatHistoryService chatHistoryService;
    @Resource
    private AppMapper appMapper;

    @Resource
    private ProjectBuildService projectBuildService;


    @Override
    public Flux<ServerSentEvent<String>> chatToGenCode(Long appId, String userMessage, User loginUser) {
        ThrowUtils.throwIf(StrUtil.isBlank(userMessage), ErrorCode.PARAMS_ERROR, "生成需求不能为空");
        // 仅应用创建者可以触发代码生成。
        App app = getOwnedApp(appId, loginUser);
        CodeGenTypeEnum codeGenType = CodeGenTypeEnum.getEnumByValue(app.getCodeGenType());
        ThrowUtils.throwIf(codeGenType == null, ErrorCode.PARAMS_ERROR, "代码生成类型不存在");

        Long userId = loginUser.getId();
        return Flux.defer(() -> {
            // 先落库用户消息，再调用 AI；不把整个耗时生成过程放进数据库事务。
            saveChatMessage(appId, userMessage, ChatHistoryMessageTypeEnum.USER, userId);
            StringBuilder aiMessage = new StringBuilder();
            // defer 同时捕获生成入口同步抛错和流式响应中的异步错误。
            return Flux.defer(() -> aiCodeGeneratorFacade.generateAndSaveCodeStream(userMessage, codeGenType, appId))
                    .map(chunk -> {
                        aiMessage.append(chunk);
                        return ServerSentEvent.<String>builder()
                                .data(JSONUtil.toJsonStr(Map.of("d", chunk)))
                                .build();
                    })
                    .concatWith(Mono.fromCallable(() -> {
                        String completeMessage = aiMessage.toString();
                        ThrowUtils.throwIf(StrUtil.isBlank(completeMessage), ErrorCode.OPERATION_ERROR, "AI 未返回有效内容");
                        // 文件保存和 AI 历史保存均成功后，才发送 done 事件。
                        saveChatMessage(appId, completeMessage, ChatHistoryMessageTypeEnum.AI, userId);
                        return ServerSentEvent.<String>builder().event("done").data("").build();
                    }))
                    .onErrorResume(error -> Mono.fromCallable(() -> {
                        log.error("代码生成流失败，appId={}", appId, error);
                        String errorMessage = StrUtil.blankToDefault(error.getMessage(), "代码生成失败，请稍后重试");
                        String failedMessage = (aiMessage.isEmpty() ? "" : aiMessage + "\n\n")
                                + "[生成失败] " + errorMessage;
                        saveChatMessage(appId, failedMessage, ChatHistoryMessageTypeEnum.AI, userId);
                        return ServerSentEvent.<String>builder()
                                .event("error")
                                .data(JSONUtil.toJsonStr(Map.of("message", errorMessage)))
                                .build();
                    }));
        });
    }

    private void saveChatMessage(Long appId, String message, ChatHistoryMessageTypeEnum messageType, Long userId) {
        boolean result = chatHistoryService.addChatHistory(appId, message, messageType.getValue(), userId);
        ThrowUtils.throwIf(!result, ErrorCode.OPERATION_ERROR, "对话历史保存失败");
    }

    /**
     * 部署应用。
     * @param appId
     * @param loginUser
     * @return
     */
    @Override
    public String deployApp(Long appId, User loginUser) {
        ThrowUtils.throwIf(appId == null, ErrorCode.PARAMS_ERROR, "应用 id 不能为空");
        getOwnedApp(appId, loginUser);

        App app = getById(appId);
        ThrowUtils.throwIf(app == null, ErrorCode.NOT_FOUND_ERROR, "应用不存在");
        // 检查是否已有deployKey
        String deployKey = app.getDeployKey();
        if (StrUtil.isBlank(deployKey)) {
            // 生成 deployKey
            deployKey = RandomUtil.randomString(6);
        }

        // 根据App的代码类别去获取部署的地址
        String codeGenType = app.getCodeGenType();
        String sourceDirName = codeGenType + "_" + appId;
        String sourceDirPath = AppConstant.CODE_OUTPUT_ROOT_DIR + File.separator + sourceDirName;


        // 工程应用部署成功发布的 dist，避免将源码和 node_modules 复制到公开站点。
        // 原生 HTML 和多文件应用仍使用现有生成目录，部署域名及 deployKey 规则保持一致。
        File sourceFile = CodeGenTypeEnum.VUE_PROJECT.getValue().equals(codeGenType)
                ? projectBuildService.getPublishedDirectory(appId).toFile()
                : new File(sourceDirPath);
        if (!sourceFile.exists() || !sourceFile.isDirectory()) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "部署目录不存在");
        }

        // 复制文件到部署目录下面
        String deployDirPath = AppConstant.CODE_DEPLOY_ROOT_DIR + File.separator + deployKey;
        try {
            FileUtil.copyContent(sourceFile, new File(deployDirPath), true);
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "部署目录复制失败");
        }

        App updateApp = new App();
        updateApp.setId(appId);
        updateApp.setDeployKey(deployKey);
        updateApp.setDeployedTime(LocalDateTime.now());
        boolean result = updateById(updateApp);
        if(!result){
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "应用部署失败");
        }
        log.info("应用部署成功，appId={}, deployKey={}", appId, deployKey);
        return String.format("%s/%s", AppConstant.CODE_DEPLOY_HOST, deployKey);

    }

    /**
     * 创建应用。
     *
     * <p>当前项目暂未接入“根据 prompt 自动选择代码生成类型”的路由服务，
     * 因此统一使用已有的多文件模式，确保 codeGenType 一定是合法枚举值，
     * 后续代码生成和保存流程不会因为类型为空而失败。</p>
     */
    @Override
    public long createApp(AppAddRequest appAddRequest, User loginUser) {
        ThrowUtils.throwIf(appAddRequest == null, ErrorCode.PARAMS_ERROR, "请求参数为空");
        Long userId = getLoginUserId(loginUser);

        // 初始化 prompt 是创建应用的唯一必填业务字段。
        String initPrompt = StrUtil.trim(appAddRequest.getInitPrompt());
        ThrowUtils.throwIf(StrUtil.isBlank(initPrompt), ErrorCode.PARAMS_ERROR,
                "应用初始化 prompt 不能为空");

        // 构造实体时只写入后端允许用户提交和系统负责生成的字段。
        App app = new App();
        app.setUserId(userId);
        app.setInitPrompt(initPrompt);

        // 暂时使用 prompt 前 12 个字符作为默认应用名称，避免创建后名称为空。
        app.setAppName(initPrompt.substring(0, Math.min(initPrompt.length(), 12)));

        // 当前系统支持 html 和 multi_file 两种类型，这里选择已有的多文件模式。
        app.setCodeGenType(CodeGenTypeEnum.MULTI_FILE.getValue());
        app.setPriority(AppConstant.DEFAULT_APP_PRIORITY);

        boolean saveResult = this.save(app);
        ThrowUtils.throwIf(!saveResult, ErrorCode.OPERATION_ERROR, "应用创建失败");
        log.info("应用创建成功，appId={}, userId={}", app.getId(), loginUser.getId());
        return app.getId();
    }

    @Override
    public boolean updateApp(AppUpdateRequest appUpdateRequest, User loginUser) {
        ThrowUtils.throwIf(appUpdateRequest == null, ErrorCode.PARAMS_ERROR, "请求参数为空");
        getOwnedApp(appUpdateRequest.getId(), loginUser);

        String appName = StrUtil.trim(appUpdateRequest.getAppName());
        ThrowUtils.throwIf(StrUtil.isBlank(appName), ErrorCode.PARAMS_ERROR, "应用名称不能为空");

        App app = new App();
        app.setId(appUpdateRequest.getId());
        app.setAppName(appName);
        app.setEditTime(LocalDateTime.now());
        boolean result = this.updateById(app);
        ThrowUtils.throwIf(!result, ErrorCode.OPERATION_ERROR, "应用更新失败");
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteApp(Long appId, User loginUser) {
        getOwnedApp(appId, loginUser);
        return adminDeleteApp(appId);
    }

    @Override
    public AppVO getAppVOById(Long appId, User loginUser) {
        // 登录用户可以只读查看其他作品；生成、部署、修改和删除仍校验归属。
        getLoginUserId(loginUser);
        return getAppVO(getExistingApp(appId));
    }

    @Override
    public Page<AppVO> listMyAppVOByPage(AppQueryRequest appQueryRequest, User loginUser) {
        validatePageRequest(appQueryRequest, true);
        Long userId = getLoginUserId(loginUser);

        // 覆盖客户端提交的归属条件，同时保留原请求，避免业务方法修改调用方的数据。
        AppQueryRequest queryRequest = new AppQueryRequest();
        BeanUtils.copyProperties(appQueryRequest, queryRequest);
        queryRequest.setUserId(userId);
        return pageAppVO(queryRequest, getQueryWrapper(queryRequest));
    }

    @Override
    public Page<AppVO> listGoodAppVOByPage(AppQueryRequest appQueryRequest) {
        validatePageRequest(appQueryRequest, true);
        return pageAppVO(appQueryRequest, getGoodAppQueryWrapper(appQueryRequest));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean adminDeleteApp(Long appId) {
        ThrowUtils.throwIf(appId == null || appId <= 0, ErrorCode.PARAMS_ERROR, "应用 id 不合法");
        App existingApp = appMapper.selectOneByQuery(QueryWrapper.create().eq("id", appId).forUpdate());
        ThrowUtils.throwIf(existingApp == null, ErrorCode.NOT_FOUND_ERROR, "应用不存在");
        boolean vueProject = CodeGenTypeEnum.VUE_PROJECT.getValue().equals(existingApp.getCodeGenType());
        // Vue 工程包含源码、构建快照和预览产物，数据库提交成功后统一清理。
        // 原生模式保留已有文件清理规则。
        if (!vueProject) {
            boolean isDeleteCodeOutput = FileUtil.del(AppConstant.CODE_OUTPUT_ROOT_DIR + File.separator + existingApp.getCodeGenType() + "_" + existingApp.getId());
            ThrowUtils.throwIf(!isDeleteCodeOutput, ErrorCode.SYSTEM_ERROR, "应用文件删除失败");
        }
        // 如果已经部署，也应该删除部署的文件
        if (StrUtil.isNotBlank(existingApp.getDeployKey())) {
            boolean isDeleteCodeDeploy = FileUtil.del(AppConstant.CODE_DEPLOY_ROOT_DIR + File.separator + existingApp.getDeployKey());
            ThrowUtils.throwIf(!isDeleteCodeDeploy, ErrorCode.SYSTEM_ERROR, "应用部署文件删除失败");
        }
        // 相应的删除对应App的历史记录
        boolean historyDeleted = chatHistoryService.deleteByAppId(appId);
        ThrowUtils.throwIf(!historyDeleted, ErrorCode.OPERATION_ERROR, "对话历史删除失败");
        // 从数据库删除该应用
        boolean result = this.removeById(appId);
        ThrowUtils.throwIf(!result, ErrorCode.OPERATION_ERROR, "应用删除失败");
        if (vueProject) {
            cleanupVueProjectAfterCommit(appId);
        }
        return true;
    }

    /**
     * 数据库删除提交后再清理工程，避免事务回滚却把应用永久标记为已删除。
     * 工程服务使用同一应用锁等待构建结束，并拒绝旧 AI 流后续的文件工具调用。
     */
    private void cleanupVueProjectAfterCommit(Long appId) {
        Runnable cleanup = () -> {
            try {
                projectBuildService.deleteProjectArtifacts(appId);
            } catch (RuntimeException e) {
                // 数据库已提交，资源清理错误只能记录并由运维重试，不能伪装成数据库回滚。
                log.error("应用已删除，但工程资源清理失败，appId={}", appId, e);
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    cleanup.run();
                }
            });
        } else {
            cleanup.run();
        }
    }

    @Override
    public boolean adminUpdateApp(AppAdminUpdateRequest appAdminUpdateRequest) {
        ThrowUtils.throwIf(appAdminUpdateRequest == null, ErrorCode.PARAMS_ERROR, "请求参数为空");
        getExistingApp(appAdminUpdateRequest.getId());

        App app = new App();
        app.setId(appAdminUpdateRequest.getId());
        if (appAdminUpdateRequest.getAppName() != null) {
            String appName = StrUtil.trim(appAdminUpdateRequest.getAppName());
            ThrowUtils.throwIf(StrUtil.isBlank(appName), ErrorCode.PARAMS_ERROR, "应用名称不能为空");
            app.setAppName(appName);
        }
        app.setCover(appAdminUpdateRequest.getCover());
        app.setPriority(appAdminUpdateRequest.getPriority());
        app.setEditTime(LocalDateTime.now());
        boolean result = this.updateById(app);
        ThrowUtils.throwIf(!result, ErrorCode.OPERATION_ERROR, "应用更新失败");
        return true;
    }

    @Override
    public Page<AppVO> adminListAppVOByPage(AppQueryRequest appQueryRequest) {
        validatePageRequest(appQueryRequest, false);
        return pageAppVO(appQueryRequest, getQueryWrapper(appQueryRequest));
    }

    @Override
    public AppVO adminGetAppVOById(Long appId) {
        return getAppVO(getExistingApp(appId));
    }

    /**
     * 校验登录用户；服务层不依赖 HTTP 请求或 Session。
     */
    private Long getLoginUserId(User loginUser) {
        ThrowUtils.throwIf(loginUser == null || loginUser.getId() == null,
                ErrorCode.NOT_LOGIN_ERROR, "用户未登录");
        return loginUser.getId();
    }

    /**
     * 查询应用并统一校验 id 和存在性。
     */
    private App getExistingApp(Long appId) {
        ThrowUtils.throwIf(appId == null || appId <= 0, ErrorCode.PARAMS_ERROR, "应用 id 不合法");
        App app = this.getById(appId);
        ThrowUtils.throwIf(app == null, ErrorCode.NOT_FOUND_ERROR, "应用不存在");
        return app;
    }

    /**
     * 生成、部署、修改和删除统一校验应用归属。
     */
    private App getOwnedApp(Long appId, User loginUser) {
        Long userId = getLoginUserId(loginUser);
        App app = getExistingApp(appId);
        ThrowUtils.throwIf(!userId.equals(app.getUserId()), ErrorCode.NO_AUTH_ERROR, "无权操作该应用");
        return app;
    }

    /**
     * 分页参数校验；普通用户和公开精选列表限制单页数量。
     */
    private void validatePageRequest(AppQueryRequest appQueryRequest, boolean limitPageSize) {
        ThrowUtils.throwIf(appQueryRequest == null, ErrorCode.PARAMS_ERROR, "请求参数为空");
        ThrowUtils.throwIf(appQueryRequest.getPageNum() <= 0 || appQueryRequest.getPageSize() <= 0,
                ErrorCode.PARAMS_ERROR, "分页参数不合法");
        ThrowUtils.throwIf(limitPageSize && appQueryRequest.getPageSize() > AppConstant.USER_APP_MAX_PAGE_SIZE,
                ErrorCode.PARAMS_ERROR, "每页最多查询 " + AppConstant.USER_APP_MAX_PAGE_SIZE + " 个应用");
    }

    /**
     * 查询并转换分页结果，复用批量用户查询，保留分页元数据。
     */
    private Page<AppVO> pageAppVO(AppQueryRequest appQueryRequest, QueryWrapper queryWrapper) {
        Page<App> appPage = this.page(
                Page.of(appQueryRequest.getPageNum(), appQueryRequest.getPageSize()), queryWrapper);
        Page<AppVO> appVOPage = new Page<>(appPage.getPageNumber(), appPage.getPageSize(), appPage.getTotalRow());
        appVOPage.setRecords(getAppVOList(appPage.getRecords()));
        return appVOPage;
    }

    /**
     * 将应用实体转换为脱敏 VO。
     */
    @Override
    public AppVO getAppVO(App app) {
        if (app == null) {
            return null;
        }

        AppVO appVO = new AppVO();
        BeanUtils.copyProperties(app, appVO);

        // 应用创建者信息只返回 UserVO，避免把密码等实体字段带到前端。
        if (app.getUserId() != null) {
            User user = userService.getById(app.getUserId());
            UserVO userVO = userService.getUserVO(user);
            appVO.setUser(userVO);
        }
        return appVO;
    }

    /**
     * 批量转换应用 VO，并批量查询用户，避免列表页面出现 N+1 次用户查询。
     */
    @Override
    public List<AppVO> getAppVOList(List<App> appList) {
        if (appList == null || appList.isEmpty()) {
            return Collections.emptyList();
        }

        // 收集所有创建者 id，并去重后一次性查询。
        Set<Long> userIds = appList.stream()
                .map(App::getUserId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        Map<Long, UserVO> userVOMap = userIds.isEmpty()
                ? Collections.emptyMap()
                : userService.listByIds(userIds).stream()
                .collect(Collectors.toMap(User::getId, userService::getUserVO,
                        (oldValue, newValue) -> oldValue));

        return appList.stream().map(app -> {
            AppVO appVO = new AppVO();
            BeanUtils.copyProperties(app, appVO);
            appVO.setUser(userVOMap.get(app.getUserId()));
            return appVO;
        }).collect(Collectors.toList());
    }

    /**
     * 构造管理员和普通查询共用的应用条件。
     */
    @Override
    public QueryWrapper getQueryWrapper(AppQueryRequest appQueryRequest) {
        if (appQueryRequest == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "请求参数为空");
        }

        return QueryWrapper.create()
                // 精确匹配的字段
                .eq("id", appQueryRequest.getId())
                .eq("codeGenType", appQueryRequest.getCodeGenType())
                .eq("deployKey", appQueryRequest.getDeployKey())
                .eq("priority", appQueryRequest.getPriority())
                .eq("userId", appQueryRequest.getUserId())
                // 文本字段使用模糊匹配，便于后台检索应用。
                .like("appName", appQueryRequest.getAppName())
                .like("cover", appQueryRequest.getCover())
                .like("initPrompt", appQueryRequest.getInitPrompt())
                .orderBy(appQueryRequest.getSortField(), "ascend".equals(appQueryRequest.getSortOrder()));
    }

    /**
     * 构造精选应用查询条件。
     *
     * <p>精选列表目前只接受应用名称搜索，其余业务条件由服务端固定，
     * 避免调用方提交 priority=0 等条件后绕开精选规则。</p>
     */
    @Override
    public QueryWrapper getGoodAppQueryWrapper(AppQueryRequest appQueryRequest) {
        if (appQueryRequest == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "请求参数为空");
        }

        return QueryWrapper.create()
                .eq("priority", AppConstant.GOOD_APP_PRIORITY)
                .like("appName", appQueryRequest.getAppName())
                .orderBy(appQueryRequest.getSortField(), "ascend".equals(appQueryRequest.getSortOrder()));
    }



}
