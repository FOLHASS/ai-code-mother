package com.xy.aicodemother.model.dto.app;

import lombok.Data;

import java.io.Serializable;

/**
 * 用户修改自己的应用请求。
 *
 * <p>目前只允许修改应用名称，应用封面、优先级、归属用户等字段
 * 由管理员接口或系统流程维护。</p>
 */
@Data
public class AppUpdateRequest implements Serializable {

    /**
     * 待修改的应用 id。
     */
    private Long id;

    /**
     * 新的应用名称。
     */
    private String appName;

    private static final long serialVersionUID = 1L;
}
