package com.xy.aicodemother.model.dto.app;

import lombok.Data;

import java.io.Serializable;

/**
 * 管理员修改应用请求。
 *
 * <p>管理员可以维护应用名称、封面和精选排序优先级，
 * 不能通过该请求修改应用所属用户、初始化提示词或部署信息。</p>
 */
@Data
public class AppAdminUpdateRequest implements Serializable {

    /**
     * 待修改的应用 id。
     */
    private Long id;

    /**
     * 应用名称；传 null 表示本次不修改。
     */
    private String appName;

    /**
     * 应用封面；传 null 表示本次不修改，传空字符串可以清空封面。
     */
    private String cover;

    /**
     * 应用优先级；优先级为 99 的应用会进入精选列表。
     */
    private Integer priority;

    private static final long serialVersionUID = 1L;
}
