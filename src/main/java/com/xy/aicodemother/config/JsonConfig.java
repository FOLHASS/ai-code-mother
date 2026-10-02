package com.xy.aicodemother.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.JacksonModule;
import tools.jackson.databind.module.SimpleModule;
import tools.jackson.databind.ser.std.ToStringSerializer;

@Configuration
public class JsonConfig {

    /**
     * Long 转 String，避免前端 JavaScript 精度丢失
     */
    @Bean
    public JacksonModule longToStringModule() {

        SimpleModule module = new SimpleModule();

        module.addSerializer(
                Long.class,
                ToStringSerializer.instance
        );

        module.addSerializer(
                Long.TYPE,
                ToStringSerializer.instance
        );

        return module;
    }
}