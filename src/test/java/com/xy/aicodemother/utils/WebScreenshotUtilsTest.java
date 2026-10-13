package com.xy.aicodemother.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class WebScreenshotUtilsTest {

    @Test
    void saveWebPageScreenshot() {
        String screenshotPath = WebScreenshotUtils.saveWebPageScreenshot("https://www.baidu.com");
        System.out.println("截图保存路径：" + screenshotPath);
    }
}