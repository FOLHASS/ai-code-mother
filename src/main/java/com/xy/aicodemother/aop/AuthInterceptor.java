package com.xy.aicodemother.aop;


import com.xy.aicodemother.annotation.AuthCheck;
import com.xy.aicodemother.exception.BusinessException;
import com.xy.aicodemother.exception.ErrorCode;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.model.enums.UserRoleEnum;
import com.xy.aicodemother.service.UserService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Aspect
@Component
public class AuthInterceptor {

    @Resource
    private UserService userService;


    /**
     * 执行拦截
     * @param joinPoint 切入点 用于获取一些额外的信息
     * @param authCheck 权限校验注解 用于获取注解中的信息
     * @return
     */
    @Around("@annotation(authCheck)")  // 有这个注解的才去生效这个注解
    public Object doInterceptor(ProceedingJoinPoint joinPoint, AuthCheck authCheck) throws Throwable {
        String mustRole = authCheck.mustRole();

        // 获取当前的请求信息
        RequestAttributes requestAttributes = RequestContextHolder.getRequestAttributes();
        HttpServletRequest request = ((ServletRequestAttributes) requestAttributes).getRequest();

        // 获取当前用户
        User user = this.userService.getLoginUser(request);
        UserRoleEnum mustRoleEnum = UserRoleEnum.getEnumByValue(mustRole);
        // 不需要权限的时候 放行
        if(mustRoleEnum == null) {
            return joinPoint.proceed(); // 继续执行下一个拦截器或目标方法
        }

        UserRoleEnum userRoleEnum = UserRoleEnum.getEnumByValue(user.getUserRole());

        // 没有权限
        if(userRoleEnum == null) {
            throw new BusinessException(ErrorCode.NO_AUTH_ERROR);
        }
        // 必须得有管理员权限
        if(UserRoleEnum.ADMIN.equals(mustRoleEnum) && !UserRoleEnum.ADMIN.equals(userRoleEnum)) {
            throw new BusinessException(ErrorCode.NO_AUTH_ERROR);
        }

        // 否则 直接放行
        return joinPoint.proceed();




    }
}
