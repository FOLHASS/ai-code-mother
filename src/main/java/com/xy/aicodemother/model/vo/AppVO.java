package com.xy.aicodemother.model.vo;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 应用脱敏展示对象。
 *
 * <p>VO 用于接口返回，避免直接暴露实体中的逻辑删除字段，
 * 同时补充创建者的脱敏用户信息，方便前端展示应用归属。</p>
 */
@Data
public class AppVO implements Serializable {

    /**
     * 应用 id。
     */
    private Long id;

    /**
     * 应用名称。
     */
    private String appName;

    /**
     * 应用封面。
     */
    private String cover;

    /**
     * 应用初始化提示词。
     */
    private String initPrompt;

    /**
     * 代码生成类型。
     */
    private String codeGenType;

    /**
     * 部署标识。
     */
    private String deployKey;

    /**
     * 部署时间。
     */
    private LocalDateTime deployedTime;

    /**
     * 应用优先级。
     */
    private Integer priority;

    /**
     * 创建用户 id。
     */
    private Long userId;

    /**
     * 编辑时间。
     */
    private LocalDateTime editTime;

    /**
     * 创建时间。
     */
    private LocalDateTime createTime;

    /**
     * 更新时间。
     */
    private LocalDateTime updateTime;

    /**
     * 创建者脱敏信息。
     */
    private UserVO user;

    private static final long serialVersionUID = 1L;
}
