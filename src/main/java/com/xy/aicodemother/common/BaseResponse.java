package com.xy.aicodemother.common;

import com.xy.aicodemother.exception.ErrorCode;
import lombok.Data;

import java.io.Serializable;

@Data
public class BaseResponse<T> implements Serializable {

    private int code;

    private T data;

    private String message;

    public BaseResponse(int code, T data, String message) {
        this.code = code;
        this.data = data;
        this.message = message;
    }

    /**
     * 未出现异常的返回请求
     * @param code
     * @param data
     */
    public BaseResponse(int code, T data) {
        this(code, data, "OK");
    }

    /**
     * 出现的异常的返回请求
     * @param errorCode
     */
    public BaseResponse(ErrorCode errorCode) {
        this(errorCode.getCode(), null, errorCode.getMessage());
    }
}
