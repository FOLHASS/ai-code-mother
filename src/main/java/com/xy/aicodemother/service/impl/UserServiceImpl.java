package com.xy.aicodemother.service.impl;

import cn.hutool.core.util.StrUtil;
import com.mybatisflex.core.query.QueryWrapper;
import com.mybatisflex.spring.service.impl.ServiceImpl;
import com.xy.aicodemother.exception.BusinessException;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.model.dto.user.UserQueryRequest;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.mapper.UserMapper;
import com.xy.aicodemother.model.enums.UserRoleEnum;
import com.xy.aicodemother.model.vo.LoginUserVO;
import com.xy.aicodemother.model.vo.UserVO;
import com.xy.aicodemother.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.DigestUtils;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

import static com.xy.aicodemother.constant.UserConstant.USER_LOGIN_STATE;

/**
 * 用户 服务层实现。
 *
 * @author yel
 * @since 2026-10-01
 */
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User>  implements UserService{

    @Override
    public long userRegister(String userAccount, String userPassword, String checkPassword) {

        // 1. 实现必要的校验
        if(StrUtil.hasBlank(userAccount, userPassword, checkPassword)){
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "参数为空");
        }
        // 校验当前用户名的长度是否在 4-20 之间
        if(userAccount.length() < 4 || userAccount.length() > 20){
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "用户账户的长度必须在 4-20 之间");
        }
        //校验当前密码是否合法，例如密码长度是否在 8-20 之间，是否包含非法字符等
        if(userPassword.length() < 8 || userPassword.length() > 20){
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "用户密码的长度必须在 8-20 之间");
        }
        if(!userPassword.equals(checkPassword)){
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "两次输入的密码不一致");
        }
        // 2. 检查用户是否已存在
        QueryWrapper queryWrapper = new QueryWrapper();
        queryWrapper.eq("userAccount", userAccount);
        long count = this.mapper.selectCountByQuery(queryWrapper);
        if(count > 0) {  // 表示当前代码已经注册过了
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "用户已存在");
        }
        // 3. 对用户的密码进行加密
        String encryptedPassword = getEncryptedPassword(userPassword);

        //4. 将当前用户保存到数据库中
        User user = new User();
        user.setUserAccount(userAccount);
        user.setUserPassword(encryptedPassword);
        user.setUserRole(UserRoleEnum.USER.getValue());
        user.setUserName("用户: " + userAccount);
        boolean saveResult = this.save(user);
        if (!saveResult) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "数据库连接异常");
        }

        return user.getId();
    }

    @Override
    public LoginUserVO getUserVo(User user) {
        if (user != null) {
            LoginUserVO loginUserVO = new LoginUserVO();
            BeanUtils.copyProperties(user, loginUserVO);
            return loginUserVO;
        }
        return null;
    }

    @Override
    public LoginUserVO userLogin(String userAccount, String userPassword, HttpServletRequest request) {
        // 1. 校验参数
        if (StrUtil.hasBlank(userAccount, userPassword)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "参数为空");
        }
        if (userAccount.length() < 4 || userAccount.length() > 20) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "用户账户的长度必须在 4-20 之间");
        }
        if (userPassword.length() < 8 || userPassword.length() > 20) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "用户密码的长度必须在 8-20 之间");
        }

        // 2. 加密
        String encryptedPassword = getEncryptedPassword(userPassword);

        // 3. 查询用户是否存在
        QueryWrapper queryWrapper = new QueryWrapper();
        queryWrapper.eq("userAccount", userAccount);
        queryWrapper.eq("userPassword", encryptedPassword);
        User user = this.mapper.selectOneByQuery(queryWrapper);
        if (user == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "用户不存在或者密码不正确");
        }
        LoginUserVO loginUserVO = getUserVo(user);

        //4. 如果用户存在，记录用户的登录态
        request.getSession().setAttribute(USER_LOGIN_STATE, user);
        return loginUserVO;
    }

    @Override
    public UserVO getUserVO(User user) {
        if(user != null){
            UserVO userVO = new UserVO();
            BeanUtils.copyProperties(user, userVO);
            return userVO;
        }
        return null;
    }

    @Override
    public List<UserVO> getUserVOList(List<User> userList) {
        if (userList != null) {
            return userList.stream().map(this::getUserVO).collect(Collectors.toList());
        }
        return List.of();
    }


    @Override
    public QueryWrapper getQueryWrapper(UserQueryRequest userQueryRequest) {
        if (userQueryRequest == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "请求参数为空");
        }
        Long id = userQueryRequest.getId();
        String userAccount = userQueryRequest.getUserAccount();
        String userName = userQueryRequest.getUserName();
        String userProfile = userQueryRequest.getUserProfile();
        String userRole = userQueryRequest.getUserRole();
        String sortField = userQueryRequest.getSortField();
        String sortOrder = userQueryRequest.getSortOrder();
        return QueryWrapper.create()
                .eq("id", id)
                .eq("userRole", userRole)
                .like("userAccount", userAccount)
                .like("userName", userName)
                .like("userProfile", userProfile)
                .orderBy(sortField, "ascend".equals(sortOrder));
    }


    @Override
    public User getLoginUser(HttpServletRequest request) {
        // 1. 判断用户是否登陆
        Object userObj = request.getSession().getAttribute(USER_LOGIN_STATE);
        User currentUser = (User) userObj;
        if (currentUser == null) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "用户未登录");
        }

        // 2. 从数据库查询当前用户信息
        long userId = currentUser.getId();
        currentUser = this.getById(userId);
        if (currentUser == null) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "用户未登录");
        }
        return currentUser;
    }

    @Override
    public boolean userLogout(HttpServletRequest request) {

        // 1. 判断用户是否登陆
        Object userObj = request.getSession().getAttribute(USER_LOGIN_STATE);
        if (userObj == null) {
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "用户未登录");
        }
        // 2. 登出操作
        request.getSession().removeAttribute(USER_LOGIN_STATE);
        return true;
    }


    @Override
    public String getEncryptedPassword(String password) {
        // 使用盐值加密算法
        String salt = "zhouyel";
        return DigestUtils.md5DigestAsHex((password + salt).getBytes(StandardCharsets.UTF_8));
    }
}
