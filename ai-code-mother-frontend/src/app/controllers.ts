import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePageDependencies, useController } from './useController.ts'
import { appApi, userApi, chatHistoryApi, notifier } from './services.ts'
import {
  LoginController,
  RegisterController,
  GlobalHeaderController,
  ProfileEditorController,
  UserListController,
  UserMutationsController,
} from '@/features/user-management'
import { HomeAppsController, HomePageController } from '@/features/home'
import {
  AppEditModalController,
  AdminAppManageController,
  type AppEditModalProps,
  type AppEditModalEvents,
} from '@/features/app-management'
import { ChatHistoryAdminController, ChatStreamApiClient } from '@/features/ai-chat'
import { PreviewRepositoryService, VisualEditorController } from '@/features/preview-editor'
import { AppChatSessionController } from '@/features/app-workbench'
import { saveArchive } from '@/shared/ui/downloadArchive.ts'
import { APP_BASE_URL } from '@/config/env.ts'
import type { PageDependencies } from '@/shared/ports.ts'

/** 组装登录页面控制器及其依赖。 */
export const useLoginController = () =>
  new LoginController(
    useRoute(),
    usePageDependencies(),
    userApi,
    window.location.origin,
    APP_BASE_URL,
  )
/** 组装注册页面控制器及其依赖。 */
export const useRegisterController = () =>
  new RegisterController(
    useRoute(),
    usePageDependencies(),
    userApi,
    window.location.origin,
    APP_BASE_URL,
  )
/** 组装全局导航控制器及其依赖。 */
export const useGlobalHeaderController = (select: (key: string) => void) =>
  new GlobalHeaderController(usePageDependencies(), userApi, useRoute(), select)
/** 组装个人资料编辑控制器及其依赖。 */
export const useProfileEditorController = () =>
  useController(new ProfileEditorController(usePageDependencies(), userApi))

/** 组装共享编辑弹窗，在目标或登录用户变化时重新加载并在关闭时取消请求。 */
function useAppEditModalController(
  props: AppEditModalProps,
  events: AppEditModalEvents,
  page: PageDependencies,
) {
  const controller = useController(new AppEditModalController(props, events, page, appApi))
  watch(
    [
      () => props.open,
      () => props.app?.id,
      () => page.session.loginUser.id,
      () => page.session.loginUser.userRole,
    ],
    () => void controller.load(),
    { immediate: true, flush: 'sync' },
  )
  return controller
}

/** 组装首页控制器及其依赖。 */
export function useHomeControllers() {
  const page = usePageDependencies()
  const appsController = useController(new HomeAppsController(page, appApi))
  watch(() => page.session.loginUser.id, appsController.sessionChanged, { flush: 'sync' })
  const pageController = useController(new HomePageController(appsController, page, appApi))
  const modalProps = {
    get open() {
      return pageController.showEditModal.value
    },
    get app() {
      return pageController.editingApp.value
    },
  }
  const editController = useAppEditModalController(
    modalProps,
    { updateOpen: pageController.setEditModalOpen, saved: appsController.handleAppSaved },
    page,
  )
  return { appsController, pageController, editController }
}
/** 组装用户列表控制器及其依赖。 */
export const useUserListController = () =>
  useController(new UserListController(usePageDependencies(), userApi))
/** 组装用户变更控制器及其依赖。 */
export function useUserMutationsController(list: UserListController) {
  return useController(
    new UserMutationsController(
      {
        loadUsers: list.loadUsers,
        refreshAfterCreation: list.refreshAfterCreation,
        refreshAfterRemoval: list.refreshAfterRemoval,
      },
      usePageDependencies(),
      userApi,
    ),
  )
}
/** 组装管理列表与编辑弹窗，保存后刷新当前页。 */
export function useAdminAppManageControllers() {
  const page = usePageDependencies()
  const controller = useController(new AdminAppManageController(page, appApi))
  const editController = useAppEditModalController(
    {
      get open() {
        return controller.showEditModal.value
      },
      get app() {
        return controller.editingApp.value
      },
    },
    { updateOpen: controller.setEditModalOpen, saved: controller.handleAppSaved },
    page,
  )
  return { controller, editController }
}
/** 组装聊天历史管理控制器及其依赖。 */
export const useChatHistoryAdminController = () =>
  useController(new ChatHistoryAdminController(usePageDependencies(), chatHistoryApi))
/** 组装应用聊天会话控制器及其依赖。 */
export function useAppChatSession() {
  const route = useRoute()
  const session = useController(
    new AppChatSessionController({
      route,
      page: usePageDependencies(),
      apps: appApi,
      history: chatHistoryApi,
      stream: new ChatStreamApiClient(),
      preview: new PreviewRepositoryService(),
      editor: new VisualEditorController(notifier),
      saveArchive,
      openUrl: (url) => {
        window.open(url, '_blank', 'noopener,noreferrer')
      },
    }),
  )
  watch(
    () => route.params.id,
    () => {
      void session.loadApp()
    },
  )
  watch(session.previewUrl, session.resetEditor, { flush: 'sync' })
  watch(
    session.canVisualEdit,
    (available) => {
      if (!available) session.resetEditor()
    },
    { flush: 'sync' },
  )
  return session
}
