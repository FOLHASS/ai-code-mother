package com.xy.aicodemother.annotation;


import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.METHOD) // 表示该注解只能用于方法
@Retention(RetentionPolicy.RUNTIME)  // 设置运行时生效
public @interface AuthCheck {
    String mustRole() default "";


}
