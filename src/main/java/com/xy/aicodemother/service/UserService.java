package com.xy.aicodemother.service;

import com.mybatisflex.core.query.QueryWrapper;
import com.mybatisflex.core.service.IService;
import com.xy.aicodemother.model.dto.user.UserQueryRequest;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.model.vo.LoginUserVO;
import com.xy.aicodemother.model.vo.UserVO;
import jakarta.servlet.http.HttpServletRequest;

import java.util.List;


// 某某service接口一般来说是用来定义规范的


/**
 * 用户 服务层。
 *
 * @author yel
 * @since 2026-10-01
 */
public interface UserService extends IService<User> {
    /**
     * 用户注册
     *
     * @param userAccount   用户账户
     * @param userPassword  用户密码
     * @param checkPassword 校验密码
     * @return 新用户 id
     */
    long userRegister(String userAccount, String userPassword, String checkPassword);


    /**
     * 获取当前的脱敏User数据
     * @param user
     * @return
     */
    LoginUserVO getUserVo(User user);


    QueryWrapper getQueryWrapper(UserQueryRequest userQueryRequest);

    /**
     * 根据用户携带Cookie去找到对应的session中存储的用户信息
     * @param request
     * @return
     */
    User getLoginUser(HttpServletRequest request);

    /**
     * 推出登陆
     * @param request
     * @return
     */
    boolean userLogout(HttpServletRequest request);


    /**
     * 实现是用户登陆接口
     * @param userAccount
     * @param userPassword
     * @param request
     * @return
     */
    LoginUserVO userLogin(String userAccount, String userPassword, HttpServletRequest request);

    /**
     * 用于返回管理员查看到脱敏后到用户信息
     * @param user
     * @return
     */
    UserVO getUserVO(User user);

    /**
     * 用于返回管理员查看到脱敏后到用户信息 - 数组版
     * @param userList
     * @return
     */
    List<UserVO> getUserVOList(List<User> userList);

    /**
     * 盐值加密方法
     * @param password
     * @return
     */
    String getEncryptedPassword(String password);
}
