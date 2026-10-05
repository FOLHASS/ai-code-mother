package com.xy.aicodemother.core.parser;
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
    public static Object parser(String content, CodeGenTypeEnum codeGenTypeEnum) { //
        return strategyMap.get(codeGenTypeEnum.getValue()).parse(content);
    }

}
