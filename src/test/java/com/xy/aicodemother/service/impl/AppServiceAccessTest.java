package com.xy.aicodemother.service.impl;

import com.xy.aicodemother.exception.BusinessException;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.model.dto.app.AppUpdateRequest;
import com.xy.aicodemother.model.entity.App;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.model.vo.AppVO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.spy;

class AppServiceAccessTest {

    private AppServiceImpl service;
    private App app;
    private AppVO appVO;

    @BeforeEach
    void setUp() {
        service = spy(new AppServiceImpl());
        app = new App();
        app.setId(100L);
        app.setUserId(1L);
        appVO = new AppVO();
        appVO.setId(app.getId());
        appVO.setUserId(app.getUserId());
        doReturn(app).when(service).getById(app.getId());
        doReturn(appVO).when(service).getAppVO(app);
    }

    @Test
    void ownerCanReadAppDetails() {
        assertSame(appVO, service.getAppVOById(app.getId(), user(1L, "user")));
    }

    @Test
    void anotherLoggedInUserCanReadAppDetails() {
        assertSame(appVO, service.getAppVOById(app.getId(), user(2L, "user")));
    }

    @Test
    void anonymousUserCannotReadAppDetails() {
        assertError(ErrorCode.NOT_LOGIN_ERROR, () -> service.getAppVOById(app.getId(), null));
    }

    @Test
    void detailRequestsStillValidateAppIdAndExistence() {
        User viewer = user(2L, "user");
        assertError(ErrorCode.PARAMS_ERROR, () -> service.getAppVOById(0L, viewer));
        doReturn(null).when(service).getById(200L);
        assertError(ErrorCode.NOT_FOUND_ERROR, () -> service.getAppVOById(200L, viewer));
    }

    @ParameterizedTest
    @ValueSource(strings = {"user", "admin"})
    void viewingAnotherAppDoesNotGrantOwnerOperations(String role) {
        User viewer = user(2L, role);
        AppUpdateRequest update = new AppUpdateRequest();
        update.setId(app.getId());
        update.setAppName("改名");

        assertError(ErrorCode.NO_AUTH_ERROR, () -> service.chatToGenCode(app.getId(), "继续生成", viewer));
        assertError(ErrorCode.NO_AUTH_ERROR, () -> service.deployApp(app.getId(), viewer));
        assertError(ErrorCode.NO_AUTH_ERROR, () -> service.updateApp(update, viewer));
        assertError(ErrorCode.NO_AUTH_ERROR, () -> service.deleteApp(app.getId(), viewer));
    }

    private static User user(Long id, String role) {
        User user = new User();
        user.setId(id);
        user.setUserRole(role);
        return user;
    }

    private static void assertError(ErrorCode expected, Executable action) {
        BusinessException exception = assertThrows(BusinessException.class, action);
        assertEquals(expected.getCode(), exception.getCode());
    }
}
