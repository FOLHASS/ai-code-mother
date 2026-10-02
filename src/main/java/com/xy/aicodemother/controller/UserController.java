package com.xy.aicodemother.controller;

import com.mybatisflex.core.paginate.Page;
import com.xy.aicodemother.annotation.AuthCheck;
import com.xy.aicodemother.common.BaseResponse;
import com.xy.aicodemother.common.DeleteRequest;
import com.xy.aicodemother.common.ResultUtils;
import com.xy.aicodemother.constant.UserConstant;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.exception.ThrowUtils;
import com.xy.aicodemother.model.dto.*;
import com.xy.aicodemother.model.vo.LoginUserVO;
import com.xy.aicodemother.model.vo.UserVO;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.BeanUtils;
import org.springframework.web.bind.annotation.*;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.service.UserService;

import java.util.List;

/**
 * 用户 控制层。
 *
 * @author yel
 * @since 2026-10-01
 */
@RestController
@RequestMapping("/user")
public class UserController {


    @Resource
    private UserService userService;


    @PostMapping("/register")
    public BaseResponse<Long> register(@RequestBody UserRegisterRequest userRegisterRequest) {
        ThrowUtils.throwIf(userRegisterRequest == null, ErrorCode.PARAMS_ERROR, "请求参数不能为空");
        String userAccount = userRegisterRequest.getUserAccount();
        String userPassword = userRegisterRequest.getUserPassword();
        String checkPassword = userRegisterRequest.getCheckPassword();
        return ResultUtils.success(userService.userRegister(userAccount, userPassword, checkPassword));
    }

    @PostMapping("/login")
    public BaseResponse<LoginUserVO> login(@RequestBody UserLoginRequest userLoginRequest, HttpServletRequest request) {
        ThrowUtils.throwIf(userLoginRequest == null, ErrorCode.PARAMS_ERROR, "请求参数为空");
        String userAccount = userLoginRequest.getUserAccount();
        String userPassword = userLoginRequest.getUserPassword();
        return ResultUtils.success(userService.userLogin(userAccount, userPassword, request));
    }

    @PostMapping("/get/login")
    public BaseResponse<LoginUserVO> getLoginUser(HttpServletRequest request) {
        User loginUser = userService.getLoginUser(request);
        return ResultUtils.success(userService.getUserVo(loginUser));
    }

    @PostMapping("/logout")
    public BaseResponse<Boolean> logout(HttpServletRequest request) {
        return ResultUtils.success(userService.userLogout(request));
    }

    @PostMapping("/add")
    @AuthCheck(mustRole = UserConstant.ADMIN_ROLE)
    public BaseResponse<Long> addUser(@RequestBody UserAddRequest userAddRequest) {
        ThrowUtils.throwIf(userAddRequest == null, ErrorCode.PARAMS_ERROR);
        User user = new User();
        BeanUtils.copyProperties(userAddRequest, user);

        final String DefaultPassword = "12345678";
        String encryptedPassword = userService.getEncryptedPassword(DefaultPassword);
        user.setUserPassword(encryptedPassword);
        boolean isSave = userService.save(user);
        ThrowUtils.throwIf(!isSave, ErrorCode.OPERATION_ERROR);
        return ResultUtils.success(user.getId());
    }

    @PostMapping("/delete")
    @AuthCheck(mustRole = UserConstant.ADMIN_ROLE)
    public BaseResponse<Boolean> deleteUser(@RequestBody DeleteRequest deleteRequest) {
        ThrowUtils.throwIf(deleteRequest == null, ErrorCode.PARAMS_ERROR);
        Long id = deleteRequest.getId();
        ThrowUtils.throwIf(id == null, ErrorCode.PARAMS_ERROR);
        return ResultUtils.success(userService.removeById(id));
    }

    @PostMapping("/get")
    @AuthCheck(mustRole = UserConstant.ADMIN_ROLE)
    public BaseResponse<User> getUserByID(long id) {
        ThrowUtils.throwIf(id <= 0, ErrorCode.PARAMS_ERROR);
        User user = this.userService.getById(id);
        ThrowUtils.throwIf(user == null, ErrorCode.NOT_FOUND_ERROR);
        return ResultUtils.success(user);
    }

    @PostMapping("/get/vo")
    public BaseResponse<UserVO> getUserVo(long id) {
        ThrowUtils.throwIf(id <= 0, ErrorCode.PARAMS_ERROR);
        User user = userService.getById(id);
        ThrowUtils.throwIf(user == null, ErrorCode.NOT_FOUND_ERROR);
        return ResultUtils.success(userService.getUserVO(user));
    }


    @PostMapping("/update")
    @AuthCheck(mustRole = UserConstant.ADMIN_ROLE)
    public BaseResponse<Boolean> updateUser(@RequestBody UserUpdateRequest userUpdateRequest) {
        ThrowUtils.throwIf(userUpdateRequest == null, ErrorCode.PARAMS_ERROR);
        User user = new User();
        BeanUtils.copyProperties(userUpdateRequest, user);
        boolean result = userService.updateById(user);
        ThrowUtils.throwIf(!result, ErrorCode.OPERATION_ERROR);
        return ResultUtils.success(true);
    }

    @PostMapping("/list/page/vo")
    @AuthCheck(mustRole = UserConstant.ADMIN_ROLE)
    public BaseResponse<Page<UserVO>> getUserVOList(@RequestBody UserQueryRequest userQueryRequest) {
        ThrowUtils.throwIf(userQueryRequest == null, ErrorCode.PARAMS_ERROR);

        long pageNum = userQueryRequest.getPageNum();
        long pageSize = userQueryRequest.getPageSize();

        // 在数据库当中进行分页查询
        Page<User> userPage = userService.page(Page.of(pageNum, pageSize), userService.getQueryWrapper(userQueryRequest));
        // 设置分页查询到基本参数【页数，每页大小，总行数】
        Page<UserVO> userVOPage = new Page<>(pageNum, pageSize, userPage.getTotalRow());
        // 转换用户数据为用户VO脱敏数据
        List<UserVO> userVOList = userService.getUserVOList(userPage.getRecords());
        // 由于返回的为Page容器，故设置
        userVOPage.setRecords(userVOList);
        return ResultUtils.success(userVOPage);

    }


}
