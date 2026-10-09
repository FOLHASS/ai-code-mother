package com.xy.aicodemother.constant;

/**
 * 应用模块常量。
 */
public interface AppConstant {

    /**
     * 默认应用优先级。
     */
    int DEFAULT_APP_PRIORITY = 0;

    /**
     * 精选应用优先级。
     *
     * <p>只有优先级恰好为 99 的应用会出现在精选列表，
     * 与管理员页面的精选标记保持一致。</p>
     */
    int GOOD_APP_PRIORITY = 99;

    /**
     * 普通用户应用列表允许的最大 pageSize。
     */
    int USER_APP_MAX_PAGE_SIZE = 20;


    /**
     * 应用生成目录
     */
    String CODE_OUTPUT_ROOT_DIR = System.getProperty("user.dir") + "/tmp/code_output";

    /**
     * 工程构建工作目录。每次构建使用独立快照，避免构建失败破坏已发布的网站。
     */
    String CODE_BUILD_ROOT_DIR = System.getProperty("user.dir") + "/tmp/project_build";

    /**
     * 工程预览产物目录，只保存已成功构建并发布的静态文件，不对外暴露源码。
     */
    String CODE_PREVIEW_ROOT_DIR = System.getProperty("user.dir") + "/tmp/code_preview";

    /**
     * 应用部署目录
     */
    String CODE_DEPLOY_ROOT_DIR = System.getProperty("user.dir") + "/tmp/code_deploy";

    /**
     * 应用部署域名
     */
    String CODE_DEPLOY_HOST = "http://localhost";

}
