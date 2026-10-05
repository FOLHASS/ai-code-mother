package com.xy.aicodemother.model.dto.app;

import com.xy.aicodemother.common.PageRequest;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serializable;

/**
 * 应用分页查询请求。
 *
 * <p>查询条件覆盖应用的业务字段，不开放时间字段作为查询条件，
 * 避免把内部时间字段暴露成不稳定的接口契约。普通用户列表和精选列表
 * 会在 Service 层额外叠加所属用户或精选优先级条件。</p>
 */
@EqualsAndHashCode(callSuper = true)
@Data
public class AppQueryRequest extends PageRequest implements Serializable {

    /**
     * 应用 id。
     */
    private Long id;

    /**
     * 应用名称，支持模糊查询。
     */
    private String appName;

    /**
     * 应用封面，支持模糊查询。
     */
    private String cover;

    /**
     * 初始化提示词，支持模糊查询。
     */
    private String initPrompt;

    /**
     * 代码生成类型，例如 html、multi_file。
     */
    private String codeGenType;

    /**
     * 部署标识。
     */
    private String deployKey;

    /**
     * 应用优先级。
     */
    private Integer priority;

    /**
     * 创建用户 id。
     */
    private Long userId;

    private static final long serialVersionUID = 1L;
}
