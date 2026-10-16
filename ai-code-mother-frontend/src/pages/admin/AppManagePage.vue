<script setup lang="ts">
/**
 * 应用管理页面向管理员：多条件分页查询全部应用，查看详情、进入对话、编辑、精选及删除。
 * 当前页、筛选草稿和详情弹窗对象由页面持有；封面、页头、统计和详情 UI 复用公共组件。
 * 生成类型的选项与中文文案取自公共枚举配置，避免管理筛选与其他页面出现不同的取值表。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useRouter } from 'vue-router'

import { adminDeleteApp, adminListAppVoByPage, adminUpdateApp } from '@/api/appController.ts'
import AppCover from '@/components/AppCover.vue'
import AppDetailsModal from '@/components/AppDetailsModal.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageStat from '@/components/PageStat.vue'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'
import { formatDate } from '@/utils/app.ts'
import { CODE_GEN_TYPE_OPTIONS, formatCodeGenType } from '@/utils/codeGenTypes.ts'

// 页面导航复用既有路由，管理员身份读取登录 Store；后端管理接口仍执行最终鉴权。
const router = useRouter()
const loginUserStore = useLoginUserStore()
// 当前请求的 loading 同时驱动查询按钮、列表占位和分页禁用，记录数组只在业务成功后更新。
const isLoading = ref(false)
// 管理列表采用页码分页，每页十条；总数来自本次筛选结果，用于页数和页头统计展示。
const currentPage = ref(1)
const pageSize = 10
const total = ref(0)
const apps = ref<API.AppVO[]>([])
// 详情弹窗直接展示当前表格行的 VO，不额外发起详情请求；显隐与选中对象分别维护。
const selectedApp = ref<API.AppVO | null>(null)
const showDetailsModal = ref(false)
// 这里保存用户编辑中的筛选条件；点击查询或重置后才由 loadApps 组装并提交请求。
const searchForm = reactive<API.AppQueryRequest>({ appName: '', cover: '', id: undefined, userId: undefined, priority: undefined, codeGenType: '', deployKey: '', initPrompt: '' })

// 角色必须精确匹配 admin，模板和加载入口都使用同一派生值控制管理页访问。
const isAdmin = computed(() => loginUserStore.loginUser.userRole === 'admin')
// 空结果时页数至少为一；实际分页控件只在记录总数超过每页数量时出现。
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

/** 校验管理员身份，整理筛选条件后按创建时间倒序查询当前页；成功才替换列表和总数。 */
const loadApps = async () => {
  if (!isAdmin.value) {
    await router.replace('/')
    return
  }
  isLoading.value = true
  try {
    // 空文本不参与筛选；优先级显式处理 undefined/null，合法的 0 不会被当作未填写。
    const response = await adminListAppVoByPage({
      pageNum: currentPage.value,
      pageSize,
      id: searchForm.id || undefined,
      appName: searchForm.appName?.trim() || undefined,
      cover: searchForm.cover?.trim() || undefined,
      initPrompt: searchForm.initPrompt?.trim() || undefined,
      codeGenType: searchForm.codeGenType?.trim() || undefined,
      deployKey: searchForm.deployKey?.trim() || undefined,
      userId: searchForm.userId || undefined,
      priority: searchForm.priority === undefined || searchForm.priority === null ? undefined : Number(searchForm.priority),
      sortField: 'createTime',
      sortOrder: 'descend',
    })
    // 业务错误沿用后端提示，保留原数组；网络异常由 catch 给出独立提示。
    if (response.data.code !== 0) {
      message.error(response.data.message || '应用列表加载失败')
      return
    }
    apps.value = response.data.data?.records || []
    total.value = response.data.data?.totalRow || 0
  } catch {
    message.error('网络异常，应用列表加载失败')
  // 不论业务提前返回还是请求抛错，都结束查询状态，恢复按钮和翻页交互。
  } finally {
    isLoading.value = false
  }
}

// 应用新的筛选条件时回到第一页，避免使用旧页码得到不存在的结果页。
const search = async () => { currentPage.value = 1; await loadApps() }
// 清空所有已支持的筛选字段，并复用 search 同时完成页码复位和数据刷新。
const reset = async () => {
  Object.assign(searchForm, { appName: '', cover: '', id: undefined, userId: undefined, priority: undefined, codeGenType: '', deployKey: '', initPrompt: '' })
  await search()
}

/** 精选本质上是管理员更新：只提交 id 与 priority=99，成功后按当前条件重新获取列表。 */
const featureApp = async (app: API.AppVO) => {
  if (!app.id) return
  try {
    const response = await adminUpdateApp({ id: app.id, priority: 99 })
    if (response.data.code !== 0 || !response.data.data) {
      message.error(response.data.message || '精选设置失败')
      return
    }
    message.success('应用已加入精选')
    // 更新可能使作品不再符合当前优先级筛选，重新查询由后端保证表格与总数一致。
    await loadApps()
  } catch {
    message.error('网络异常，精选设置失败')
  }
}

// 删除先显示名称和不可恢复提示；接口调用位于确认回调中，取消确认不会发起请求。
const removeApp = (app: API.AppVO) => {
  if (!app.id) return
  Modal.confirm({
    title: '确认删除应用？',
    content: `删除后将无法恢复“${app.appName || '未命名应用'}”。`,
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    // 返回 Promise 让确认弹窗跟随异步回调，表格刷新只在后端确认删除成功之后发生。
    onOk: async () => {
      try {
        const response = await adminDeleteApp({ id: app.id })
        if (response.data.code !== 0 || !response.data.data) {
          message.error(response.data.message || '应用删除失败')
          return
        }
        message.success('应用已删除')
        // 如果删除的是当前页最后一条，先退一页再查询，避免留下空的尾页。
        if (apps.value.length === 1 && currentPage.value > 1) currentPage.value -= 1
        await loadApps()
      } catch {
        message.error('网络异常，应用删除失败')
      }
    },
  })
}

// 将被点击的表格行交给详情弹窗，公共弹窗通过事件把查看和编辑动作再交回本页。
const openDetails = (app: API.AppVO) => {
  selectedApp.value = app
  showDetailsModal.value = true
}

// “查看”进入应用对话页面；缺少 ID 时不导航，详情弹窗中的查看事件也复用此函数。
const openApp = (app: API.AppVO) => {
  if (app.id) void router.push(`/app/${app.id}`)
}

// 管理员编辑沿用独立编辑页，由该页读取详情、回填管理员字段并提交更新。
const editApp = (app: API.AppVO) => {
  if (app.id) void router.push(`/app/edit/${app.id}`)
}

// 先等待用户信息加载再查询，防止 Store 尚未初始化时被错误重定向到首页。
onMounted(async () => {
  await loginUserStore.fetchLoginUser()
  await loadApps()
})
// 模板依次组合页头统计、筛选面板、表格与分页、应用详情弹窗。
// 表格按加载/无数据/记录三种状态渲染；已精选项隐藏“精选”按钮，部署状态仅根据 deployKey 展示。
// AppDetailsModal 使用 update:open 同步显隐，open-app/edit-app 与表格按钮共用导航函数。
</script>

<template>
  <section v-if="isAdmin" class="app-manage-page">
    <PageHeader eyebrow="ADMIN CONSOLE" title="应用管理" description="查看、筛选和维护平台上的全部应用。">
      <template #actions><PageStat :value="total" label="应用总数" /></template>
    </PageHeader>
    <section class="query-panel">
      <div class="query-grid">
        <label><span>应用 ID</span><input v-model="searchForm.id" type="text" inputmode="numeric" placeholder="应用 ID" /></label>
        <label><span>应用名称</span><input v-model="searchForm.appName" type="text" placeholder="输入名称关键词" /></label>
        <label><span>封面地址</span><input v-model="searchForm.cover" type="text" placeholder="输入封面地址" /></label>
        <label><span>用户 ID</span><input v-model="searchForm.userId" type="text" inputmode="numeric" placeholder="创建者 ID" /></label>
        <label><span>优先级</span><input v-model.number="searchForm.priority" type="number" min="0" placeholder="如 99" /></label>
        <label><span>生成类型</span><select v-model="searchForm.codeGenType"><option value="">全部类型</option><option v-for="option in CODE_GEN_TYPE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
        <label><span>部署标识</span><input v-model="searchForm.deployKey" type="text" placeholder="部署标识" /></label>
      </div>
      <label class="prompt-filter"><span>初始需求</span><input v-model="searchForm.initPrompt" type="text" placeholder="搜索初始需求内容" /></label>
      <div class="query-actions"><button class="secondary-button" type="button" @click="reset">重置</button><button class="primary-button" type="button" :disabled="isLoading" @click="search">{{ isLoading ? '查询中...' : '查询应用' }}</button></div>
    </section>

    <section class="table-panel">
      <div class="table-heading"><div><h2>全部应用</h2><span>共 {{ total }} 条记录</span></div><span>管理员可以编辑任意应用</span></div>
      <div class="table-wrap">
        <table><thead><tr><th>应用</th><th>创建者</th><th>生成类型</th><th>优先级</th><th>部署状态</th><th>创建时间</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-if="isLoading"><td colspan="7" class="empty-cell">正在加载应用数据...</td></tr>
            <tr v-else-if="!apps.length"><td colspan="7" class="empty-cell">暂无符合条件的应用</td></tr>
            <tr v-for="app in apps" v-else :key="app.id">
              <td><div class="app-cell"><AppCover :app="app" size="table" /><div><strong>{{ app.appName || '未命名应用' }}</strong><small>#{{ app.id }}</small></div></div></td>
              <td><div class="owner-cell"><span>{{ app.user?.userName || '用户 #' + (app.userId || '-') }}</span><small>ID {{ app.userId || '-' }}</small></div></td>
              <td><span class="type-badge">{{ app.codeGenType ? formatCodeGenType(app.codeGenType) : '-' }}</span></td>
              <td><span class="priority-badge" :class="{ featured: app.priority === 99 }">{{ app.priority === 99 ? '精选' : app.priority ?? 0 }}</span></td>
              <td><span class="deploy-state" :class="{ deployed: app.deployKey }"><i></i>{{ app.deployKey ? '已部署' : '未部署' }}</span></td>
              <td class="date-cell">{{ formatDate(app.createTime) }}</td>
              <td><div class="action-buttons"><button type="button" @click="openDetails(app)">详情</button><button type="button" @click="openApp(app)">查看</button><button type="button" @click="editApp(app)">编辑</button><button v-if="app.priority !== 99" type="button" @click="featureApp(app)">精选</button><button class="danger" type="button" @click="removeApp(app)">删除</button></div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="total > pageSize" class="pagination"><button type="button" :disabled="currentPage <= 1 || isLoading" @click="currentPage -= 1; loadApps()">上一页</button><span>第 {{ currentPage }} / {{ totalPages }} 页</span><button type="button" :disabled="currentPage >= totalPages || isLoading" @click="currentPage += 1; loadApps()">下一页</button></div>
    </section>

    <AppDetailsModal
      v-model:open="showDetailsModal"
      :app="selectedApp"
      @open-app="openApp"
      @edit-app="editApp"
    />
  </section>
</template>

<style scoped>
/* 管理页与用户管理页保持居中、有限最大宽度的面板布局；可横向滚动的表格保留列可读性。 */
.app-manage-page { width: min(1280px, calc(100% - 48px)); margin: 0 auto; color: #20364d; }
/* 筛选区默认四列，表格固定最小宽度以容纳作者、部署和操作列；外层 table-wrap 承担横向滚动。
 * 行内徽标区分生成类型、精选优先级与部署状态，危险操作仅改变文字色，不改变按钮位置。
 * 操作区和分页维持紧凑排布；按钮禁用样式用于说明加载中或到达分页边界。
 */
 .query-panel, .table-panel { padding: 22px; background: #fff; border: 1px solid #e4edf2; border-radius: 10px; box-shadow: 0 7px 24px rgb(34 82 105 / 4%); }.query-panel { margin-bottom: 18px; }.query-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }.query-grid label, .prompt-filter { display: flex; flex-direction: column; gap: 7px; }.query-grid span, .prompt-filter span { color: #647b87; font-size: 12px; font-weight: 600; }.query-grid input, .query-grid select, .prompt-filter input { min-height: 37px; padding: 0 10px; color: #405966; font: inherit; font-size: 12px; background: #fbfdfd; border: 1px solid #dbe7e9; border-radius: 6px; outline: 0; }.prompt-filter { margin-top: 14px; }.query-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 17px; }.primary-button, .secondary-button { min-height: 36px; padding: 0 14px; font: inherit; font-size: 12px; border-radius: 6px; cursor: pointer; }.primary-button { color: #fff; background: #258f84; border: 1px solid #258f84; }.secondary-button { color: #5d7480; background: #fff; border: 1px solid #d6e4e8; }.table-heading { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 18px; }.table-heading h2 { margin: 0 0 5px; color: #203a4f; font-size: 18px; }.table-heading span { color: #98a7ae; font-size: 11px; }.table-wrap { overflow-x: auto; }table { width: 100%; min-width: 850px; border-collapse: collapse; }th { padding: 11px 9px; color: #91a0a7; font-size: 11px; font-weight: 650; text-align: left; background: #f8fbfb; border-bottom: 1px solid #e3edef; }td { padding: 13px 9px; color: #54707c; font-size: 12px; border-bottom: 1px solid #eff3f4; }tbody tr:hover { background: #fbfdfd; }.app-cell, .owner-cell { display: flex; align-items: center; gap: 9px; }.app-cell strong, .owner-cell span { display: block; color: #294454; font-size: 12px; }.app-cell small, .owner-cell small { display: block; margin-top: 4px; color: #a0adb2; font-size: 10px; }.type-badge, .priority-badge { display: inline-block; padding: 5px 7px; font-size: 10px; background: #f2f7f8; border-radius: 5px; }.priority-badge.featured { color: #8a6a20; background: #fff3d0; }.deploy-state { display: inline-flex; align-items: center; gap: 5px; color: #a0adb1; font-size: 11px; }.deploy-state i { width: 6px; height: 6px; background: #c4d0d2; border-radius: 50%; }.deploy-state.deployed { color: #31947f; }.deploy-state.deployed i { background: #36b68c; }.date-cell { white-space: nowrap; }.action-buttons { display: flex; gap: 10px; }.action-buttons button { padding: 0; color: #398f85; font: inherit; font-size: 11px; background: none; border: 0; cursor: pointer; }.action-buttons button.danger { color: #bd6a72; }.empty-cell { padding: 46px 10px; color: #a0adb3; text-align: center; }.pagination { display: flex; justify-content: center; align-items: center; gap: 14px; margin-top: 18px; color: #8d9da5; font-size: 11px; }.pagination button { padding: 6px 10px; color: #587580; background: #fff; border: 1px solid #d9e7e9; border-radius: 5px; cursor: pointer; }.pagination button:disabled { color: #bec9cc; cursor: not-allowed; }
/* 平板筛选降为两列；手机降为单列并缩小面板内边距，表格仍通过外层滚动访问全部字段。 */
@media (max-width: 900px) { .query-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .page-header { flex-direction: column; }.query-grid { grid-template-columns: 1fr; }.query-panel, .table-panel { padding: 16px; }.table-heading { align-items: flex-start; flex-direction: column; gap: 8px; } }
</style>
