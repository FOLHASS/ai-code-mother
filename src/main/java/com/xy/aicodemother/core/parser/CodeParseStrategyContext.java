package com.xy.aicodemother.core.parser;
import com.xy.aicodemother.exception.BusinessException;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.model.enums.CodeGenTypeEnum;

import java.util.Map;


/**
 * 交给SpringBoot自动创建和管理策略上下文对象
 */
public class CodeParseStrategyContext {
    private static Map<String, CodeParseStrategy> strategyMap = Map.of(
            CodeGenTypeEnum.HTML.getValue(), new HtmlCodeParseStrategy(),
            CodeGenTypeEnum.MULTI_FILE.getValue(), new MultiFileCodeParseStrategy()
    );

    /**
     * 根据类型选择对应的策略。- 运用策略模式
     * @param codeGenTypeEnum
     * @param content
     * @return
     */
    public static Object parser(String content, CodeGenTypeEnum codeGenTypeEnum) {
        // 先校验类型，避免类型为空时直接触发难以定位的 NullPointerException。
        if (codeGenTypeEnum == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "代码生成类型不能为空");
        }

        CodeParseStrategy strategy = strategyMap.get(codeGenTypeEnum.getValue());
        // 策略表和枚举需要保持同步；如果未来新增枚举但忘记注册，这里给出明确错误。
        if (strategy == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR,
                    "不支持的代码生成类型: " + codeGenTypeEnum.getValue());
        }
        return strategy.parse(content);
    }

}
