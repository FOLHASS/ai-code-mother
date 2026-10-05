package com.xy.aicodemother.service;

import com.mybatisflex.core.paginate.Page;
import com.mybatisflex.core.query.QueryWrapper;
import com.mybatisflex.core.service.IService;
import com.xy.aicodemother.model.dto.app.AppAddRequest;
import com.xy.aicodemother.model.dto.app.AppAdminUpdateRequest;
import com.xy.aicodemother.model.dto.app.AppQueryRequest;
import com.xy.aicodemother.model.dto.app.AppUpdateRequest;
import com.xy.aicodemother.model.entity.App;
import com.xy.aicodemother.model.entity.User;
import com.xy.aicodemother.model.vo.AppVO;
import org.springframework.http.codec.ServerSentEvent;
import reactor.core.publisher.Flux;

import java.util.List;

/**
 * 应用服务接口。
 *
 * <p>Controller 只负责 HTTP 参数绑定和权限注解，应用的业务校验、
 * 归属判断、分页规则和数据转换统一由本接口的实现类处理。</p>
 */
public interface AppService extends IService<App> {

    /**
     * 创建应用。
     *
     * @param appAddRequest 创建请求，只接收初始化 prompt
     * @param loginUser     当前登录用户
     * @return 新应用 id
     */
    long createApp(AppAddRequest appAddRequest, User loginUser);

    /**
     * 用户修改自己的应用名称。
     *
     * @param appUpdateRequest 用户修改请求
     * @param loginUser        当前登录用户
     * @return 是否更新成功
     */
    boolean updateApp(AppUpdateRequest appUpdateRequest, User loginUser);

    /**
     * 用户删除自己的应用。
     *
     * @param appId     应用 id
     * @param loginUser 当前登录用户
     * @return 是否删除成功
     */
    boolean deleteApp(Long appId, User loginUser);

    /**
     * 用户查看自己创建的应用详情。
     *
     * @param appId     应用 id
     * @param loginUser 当前登录用户
     * @return 应用详情
     */
    AppVO getAppVOById(Long appId, User loginUser);

    /**
     * 用户分页查询自己的应用。
     *
     * @param appQueryRequest 查询条件
     * @param loginUser       当前登录用户
     * @return 应用 VO 分页结果
     */
    Page<AppVO> listMyAppVOByPage(AppQueryRequest appQueryRequest, User loginUser);

    /**
     * 分页查询精选应用。
     *
     * @param appQueryRequest 查询条件
     * @return 精选应用 VO 分页结果
     */
    Page<AppVO> listGoodAppVOByPage(AppQueryRequest appQueryRequest);

    /**
     * 管理员删除任意应用。
     *
     * @param appId 应用 id
     * @return 是否删除成功
     */
    boolean adminDeleteApp(Long appId);

    /**
     * 管理员更新任意应用。
     *
     * @param appAdminUpdateRequest 管理员更新请求
     * @return 是否更新成功
     */
    boolean adminUpdateApp(AppAdminUpdateRequest appAdminUpdateRequest);

    /**
     * 管理员分页查询应用。
     *
     * @param appQueryRequest 查询条件
     * @return 应用 VO 分页结果
     */
    Page<AppVO> adminListAppVOByPage(AppQueryRequest appQueryRequest);

    /**
     * 管理员查看任意应用详情。
     *
     * @param appId 应用 id
     * @return 应用详情
     */
    AppVO adminGetAppVOById(Long appId);

    /**
     * 将应用实体转换为接口返回对象。
     *
     * @param app 应用实体
     * @return 应用 VO
     */
    AppVO getAppVO(App app);

    /**
     * 批量将应用实体转换为接口返回对象。
     *
     * @param appList 应用实体列表
     * @return 应用 VO 列表
     */
    List<AppVO> getAppVOList(List<App> appList);

    /**
     * 构造通用应用查询条件。
     *
     * @param appQueryRequest 查询请求
     * @return MyBatis-Flex 查询条件
     */
    QueryWrapper getQueryWrapper(AppQueryRequest appQueryRequest);

    /**
     * 构造精选应用查询条件。
     *
     * <p>该方法会强制追加精选优先级条件，调用方不能通过请求参数绕过精选筛选。</p>
     *
     * @param appQueryRequest 查询请求
     * @return 精选应用查询条件
     */
    QueryWrapper getGoodAppQueryWrapper(AppQueryRequest appQueryRequest);

    /**
     * 等待代码生成和文件保存完成后返回完整代码。
     *
     * @param appId       应用 id
     * @param userMessage 用户需求
     * @param loginUser   当前登录用户
     * @return 完整生成结果
     */
    Flux<ServerSentEvent<String>> chatToGenCode(Long appId, String userMessage, User loginUser);
}
