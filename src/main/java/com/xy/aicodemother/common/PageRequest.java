package com.xy.aicodemother.common;

import lombok.Data;


/**
 * 主要用于实现分页查询
 * 只要需要这下面这几个字段， 可以直接继承这个class
 */
@Data
public class PageRequest {

    /**
     * 当前页号
     */
    private int pageNum = 1;

    /**
     * 页面大小
     */
    private int pageSize = 10;

    /**
     * 排序字段
     */
    private String sortField;

    /**
     * 排序顺序（默认降序）
     */
    private String sortOrder = "descend";
}
