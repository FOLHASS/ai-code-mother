package com.xy.aicodemother.service;

import jakarta.servlet.http.HttpServletResponse;

public interface DownloadService {

    void downloadCodeAsZip(String projectPath, String downloadFileName, HttpServletResponse response);
}
