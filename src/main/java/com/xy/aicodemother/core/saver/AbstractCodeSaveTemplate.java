package com.xy.aicodemother.core.saver;

import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.exception.ThrowUtils;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;

import java.io.File;
import java.nio.charset.StandardCharsets;

public abstract class AbstractCodeSaveTemplate<T>{
    // 文件保存根目录
    private static final String FILE_SAVE_ROOT_DIR = System.getProperty("user.dir") + "/tmp/code_output";

    public final File saveCode(T result, long appId){
        // 1. 验证输入
        validateInput(result);
        // 2. 生成唯一的文件目录
        String baseDirPath = buildUniqueDir(appId);
        // 3. 保存文件
        saveFiles(result, baseDirPath);
        // 返回文件
        return new File(baseDirPath);
    }

    protected void validateInput(T result){
        ThrowUtils.throwIf(result == null, ErrorCode.PARAMS_ERROR, "参数为空");
    }


    /**
     * 构建唯一目录路径：tmp/code_output/bizType_雪花ID
     */
    protected final String buildUniqueDir(long appId) {
        String uniqueDirName = StrUtil.format("{}_{}", getCodeType(), appId);
        String dirPath = FILE_SAVE_ROOT_DIR + File.separator + uniqueDirName;
        FileUtil.mkdir(dirPath);
        return dirPath;
    }

    /**
     * 写入单个文件
     */
    protected final void writeToFile(String dirPath, String filename, String content) {
        String filePath = dirPath + File.separator + filename;
        FileUtil.writeString(content, filePath, StandardCharsets.UTF_8);
    }

    /**
     * 获取当前要生成的代码类型
     * @return
     */
    protected abstract CodeGenTypeEnum getCodeType();

    /**
     * 保存文件
     * @param result
     * @param baseDirPath
     */
    protected abstract void saveFiles(T result, String baseDirPath);

}
