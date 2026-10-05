package com.xy.aicodemother.model.dto.app;

import lombok.Data;

import java.io.Serializable;

/**
 * 创建应用请求。
 *
 * <p>创建应用时，前端只需要提交用户对应用的自然语言描述。
 * 应用名称、创建用户、代码生成类型等字段由后端统一补充，
 * 避免客户端伪造应用归属或写入不允许修改的系统字段。</p>
 */
@Data
public class AppAddRequest implements Serializable {

    /**
     * 应用初始化提示词，也是后续 AI 生成应用的初始需求。
     */
    private String initPrompt;

    private static final long serialVersionUID = 1L;
}
