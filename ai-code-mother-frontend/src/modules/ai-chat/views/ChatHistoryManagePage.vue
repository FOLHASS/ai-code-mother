<script setup lang="ts">
/**
 * 对话历史管理页：管理员按消息、应用、用户、角色和内容检索全部应用的持久化消息。
 * 当前实现提供分页、完整消息详情和所属应用跳转；列表请求、筛选与弹窗状态集中于本页。
 * 表格中的长消息仅展示摘要，详情弹窗保留消息完整换行和内容以便检查。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { Modal } from 'ant-design-vue'
import { useRouter } from 'vue-router'

import { listAdminChatHistory } from '../api/chatHistoryApi.ts'
import PageHeader from '@/components/PageHeader.vue'
import PageStat from '@/components/PageStat.vue'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'
import { formatDateTime } from '@/shared/formatters/date.ts'

const router = useRouter()
const loginUserStore = useLoginUserStore()
// loading 防止同页请求重入；loadError 独立呈现业务或网络错误，并提供重新加载入口。
const isLoading = ref(false)
const loadError = ref('')
// 管理端是普通页码分页，每页十条，与应用对话区向前加载的游标分页相互独立。
const currentPage = ref(1)
const pageSize = 10
const total = ref(0)
// 历史记录来自后端 VO；详情弹窗复用被点击行，不修改表格对象也不额外获取详情。
const histories = ref<API.ChatHistoryVO[]>([])
const selectedHistory = ref<API.ChatHistoryVO | null>(null)
const showDetailsModal = ref(false)
// ID 输入保持字符串以支持后端长整型；请求前再通过 asApiLongId 适配生成接口的参数类型。
const searchForm = reactive({
  id: '',
  appId: '',
  userId: '',
  messageType: '',
  message: '',
})

// 模板和请求入口共用管理员角色判断，服务端接口仍承担真正的数据访问控制。
const isAdmin = computed(() => loginUserStore.loginUser.userRole === 'admin')
// 无数据时总页数按一页计算，分页区域只在有多页且当前没有错误时显示。
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
// 区分用户和 AI 的消息文案；未知类型回显原始值，空类型显示占位，避免误标消息角色。
const getMessageTypeLabel = (type?: string) => type === 'user' ? '用户' : type === 'ai' ? 'AI' : type || '-'

/** 以创建时间倒序加载当前筛选页；加载前清空旧错误，成功后同时更新记录与总数。 */
const loadHistories = async () => {
  // 同一时刻只执行一个列表请求；非管理员离开此页，避免继续调用后台查询接口。
  if (isLoading.value) return
  if (!isAdmin.value) {
    await router.replace('/')
    return
  }
  isLoading.value = true
  loadError.value = ''
  try {
    // 空 ID、空关键词和未选择角色都不传筛选值；ID 不进行 Number 转换，避免长整型精度损失。
    const response = await listAdminChatHistory({
      pageNum: currentPage.value,
      pageSize,
      id: searchForm.id.trim() || undefined,
      appId: searchForm.appId.trim() || undefined,
      userId: searchForm.userId.trim() || undefined,
      messageType: searchForm.messageType || undefined,
      message: searchForm.message?.trim() || undefined,
      sortField: 'createTime',
      sortOrder: 'descend',
    })
    // 业务失败仅更新错误提示，模板在错误态隐藏旧数据并提供重试，不把失败误展示为空结果。
    if (response.data.code !== 0) {
      loadError.value = response.data.message || '对话历史加载失败'
      return
    }
    histories.value = response.data.data?.records || []
    total.value = response.data.data?.totalRow || 0
  } catch {
    loadError.value = '网络异常，对话历史加载失败'
  // 异常和提前返回都会释放加载锁，确保“重新加载”和其他查询动作仍可继续使用。
  } finally {
    isLoading.value = false
  }
}

// 提交筛选时回到第一页；请求进行中忽略重复提交，避免当前页和正在请求的页码不一致。
const search = async () => {
  if (isLoading.value) return
  currentPage.value = 1
  await loadHistories()
}

// 重置全部查询草稿，再复用 search 完成第一页加载，保持清空与手动查询的请求构造一致。
const reset = async () => {
  Object.assign(searchForm, { id: '', appId: '', userId: '', messageType: '', message: '' })
  await search()
}

// 同时检查请求锁和页码上下界，只有合法的目标页才更新状态并请求新数据。
const changePage = async (page: number) => {
  if (isLoading.value || page < 1 || page > totalPages.value) return
  currentPage.value = page
  await loadHistories()
}

// 先选中消息再显示弹窗，详情区即可一次性读取本行 ID、角色、时间和完整正文。
const openDetails = (history: API.ChatHistoryVO) => {
  selectedHistory.value = history
  showDetailsModal.value = true
}

// 从记录关联的 appId 进入应用对话页；表格和详情弹窗共享同一个入口。
const openApp = (history: API.ChatHistoryVO) => {
  if (history.appId) void router.push(`/app/${history.appId}`)
}

// 等待登录态初始化再加载，避免把尚未得到管理员信息的初始 Store 当作无权限用户。
onMounted(async () => {
  await loginUserStore.fetchLoginUser()
  await loadHistories()
})
// 页面采用“筛选 → 列表 → 完整消息弹窗”的单向数据流，选中项不回写列表。
// 列表渲染优先级为加载、错误、空态、记录；角色徽标复用 getMessageTypeLabel 区分 AI 与用户。
// 原生查询表单拦截默认提交，回车与查询按钮都调用 search；消息详情使用 pre 保留正文排版。
</script>

<template>
  <section v-if="isAdmin" class="chat-history-manage-page">
    <PageHeader eyebrow="ADMIN CONSOLE" title="对话管理" description="查看和筛选平台全部应用的对话历史。">
      <template #actions><PageStat :value="total" label="消息总数" /></template>
    </PageHeader>

    <form class="query-panel" @submit.prevent="search">
      <div class="query-grid">
        <label><span>消息 ID</span><input v-model="searchForm.id" type="text" inputmode="numeric" placeholder="消息 ID" /></label>
        <label><span>应用 ID</span><input v-model="searchForm.appId" type="text" inputmode="numeric" placeholder="所属应用 ID" /></label>
        <label><span>用户 ID</span><input v-model="searchForm.userId" type="text" inputmode="numeric" placeholder="用户 ID" /></label>
        <label><span>消息类型</span><select v-model="searchForm.messageType" aria-label="消息类型"><option value="">全部类型</option><option value="user">用户消息</option><option value="ai">AI 消息</option></select></label>
      </div>
      <label class="message-filter"><span>消息内容</span><input v-model="searchForm.message" type="text" placeholder="输入消息关键词" /></label>
      <div class="query-actions"><button class="secondary-button" type="button" :disabled="isLoading" @click="reset">重置</button><button class="primary-button" type="submit" :disabled="isLoading">{{ isLoading ? '查询中...' : '查询对话' }}</button></div>
    </form>

    <section class="table-panel">
      <div class="table-heading"><div><h2>全部对话</h2><span>共 {{ total }} 条记录</span></div><span>按创建时间从新到旧展示</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>消息 ID</th><th>应用 ID</th><th>用户 ID</th><th>消息类型</th><th>消息内容</th><th>创建时间</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-if="isLoading"><td colspan="7" class="empty-cell">正在加载对话数据...</td></tr>
            <tr v-else-if="loadError"><td colspan="7" class="empty-cell error-cell"><p role="alert">{{ loadError }}</p><button type="button" @click="loadHistories">重新加载</button></td></tr>
            <tr v-else-if="!histories.length"><td colspan="7" class="empty-cell">暂无符合条件的对话记录</td></tr>
            <tr v-for="history in histories" v-else :key="history.id">
              <td class="id-cell">{{ history.id || '-' }}</td>
              <td class="id-cell">{{ history.appId || '-' }}</td>
              <td class="id-cell">{{ history.userId || '-' }}</td>
              <td><span class="type-badge" :class="{ 'ai-message': history.messageType === 'ai' }">{{ getMessageTypeLabel(history.messageType) }}</span></td>
              <td class="message-cell"><p>{{ history.message || '-' }}</p></td>
              <td class="date-cell">{{ formatDateTime(history.createTime) }}</td>
              <td><div class="action-buttons"><button type="button" @click="openDetails(history)">详情</button><button v-if="history.appId" type="button" @click="openApp(history)">查看应用</button></div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="total > pageSize && !loadError" class="pagination"><button type="button" :disabled="currentPage <= 1 || isLoading" @click="changePage(currentPage - 1)">上一页</button><span>第 {{ currentPage }} / {{ totalPages }} 页</span><button type="button" :disabled="currentPage >= totalPages || isLoading" @click="changePage(currentPage + 1)">下一页</button></div>
    </section>

    <Modal v-model:open="showDetailsModal" title="对话详情" :footer="null" width="720px">
      <div v-if="selectedHistory" class="history-details">
        <dl class="history-meta">
          <div><dt>消息 ID</dt><dd>{{ selectedHistory.id || '-' }}</dd></div>
          <div><dt>应用 ID</dt><dd>{{ selectedHistory.appId || '-' }}</dd></div>
          <div><dt>用户 ID</dt><dd>{{ selectedHistory.userId || '-' }}</dd></div>
          <div><dt>消息类型</dt><dd>{{ getMessageTypeLabel(selectedHistory.messageType) }}</dd></div>
          <div><dt>创建时间</dt><dd>{{ formatDateTime(selectedHistory.createTime) }}</dd></div>
        </dl>
        <div class="history-content"><span>完整消息</span><pre>{{ selectedHistory.message || '暂无消息内容' }}</pre></div>
        <div class="query-actions"><button class="secondary-button" type="button" @click="showDetailsModal = false">关闭</button><button v-if="selectedHistory.appId" class="primary-button" type="button" @click="openApp(selectedHistory)">查看应用</button></div>
      </div>
    </Modal>
  </section>
</template>

<style scoped>
/* 管理页沿用应用管理页的居中容器、白色查询面板和白色列表面板，保持后台视觉一致。 */
.chat-history-manage-page { width: min(1280px, calc(100% - 48px)); margin: 0 auto; color: #20364d; }
.query-panel, .table-panel { padding: 22px; background: #fff; border: 1px solid #e4edf2; border-radius: 10px; box-shadow: 0 7px 24px rgb(34 82 105 / 4%); }
.query-panel { margin-bottom: 18px; }
/* 桌面四列筛选，关键词单独占整行；断点处逐级变为两列和一列。 */
.query-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.query-grid label, .message-filter { display: flex; flex-direction: column; gap: 7px; }
.query-grid span, .message-filter span { color: #647b87; font-size: 12px; font-weight: 600; }
.query-grid input, .query-grid select, .message-filter input { min-height: 37px; padding: 0 10px; color: #405966; font: inherit; font-size: 12px; background: #fbfdfd; border: 1px solid #dbe7e9; border-radius: 6px; outline: 0; }
.query-grid input:focus, .query-grid select:focus, .message-filter input:focus { border-color: #65b9ad; box-shadow: 0 0 0 3px rgb(101 185 173 / 12%); }
.message-filter { margin-top: 14px; }
.query-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 17px; }
.primary-button, .secondary-button { min-height: 36px; padding: 0 14px; font: inherit; font-size: 12px; border-radius: 6px; cursor: pointer; }
.primary-button { color: #fff; background: #258f84; border: 1px solid #258f84; }
.secondary-button { color: #5d7480; background: #fff; border: 1px solid #d6e4e8; }
.primary-button:disabled, .secondary-button:disabled { cursor: wait; opacity: .55; }
.table-heading { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 18px; }
.table-heading h2 { margin: 0 0 5px; color: #203a4f; font-size: 18px; }
.table-heading span { color: #98a7ae; font-size: 11px; }
/* 表格保留 1040px 最小宽度供长 ID 和操作列展示，窄屏由外层滚动而非强行压缩所有列。 */
.table-wrap { overflow-x: auto; }
table { width: 100%; min-width: 1040px; border-collapse: collapse; }
th { padding: 11px 9px; color: #91a0a7; font-size: 11px; font-weight: 650; text-align: left; background: #f8fbfb; border-bottom: 1px solid #e3edef; }
td { padding: 13px 9px; color: #54707c; font-size: 12px; border-bottom: 1px solid #eff3f4; }
tbody tr:hover { background: #fbfdfd; }
/* 默认角色徽标用于用户及未知类型；AI 类型叠加绿色样式以支持快速区分消息来源。 */
.type-badge { display: inline-block; padding: 5px 7px; color: #4e7688; font-size: 10px; background: #eff5fa; border-radius: 5px; white-space: nowrap; }
.type-badge.ai-message { color: #398f85; background: #eaf7f2; }
.id-cell, .date-cell { white-space: nowrap; }
.message-cell { width: 28%; }
/* 列表正文保留换行但截断到两行，超长字符串允许任意位置换行；完整内容在详情弹窗展示。 */
.message-cell p { display: -webkit-box; max-width: 320px; margin: 0; overflow: hidden; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.action-buttons { display: flex; gap: 10px; white-space: nowrap; }
.action-buttons button { padding: 0; color: #398f85; font: inherit; font-size: 11px; background: none; border: 0; cursor: pointer; }
.empty-cell { padding: 46px 10px; color: #a0adb3; text-align: center; }
/* 错误行使用独立提示色和轻量重试入口，区别于没有匹配记录时的普通空态。 */
.error-cell p { margin: 0 0 12px; color: #bd6a72; }
.error-cell button { color: #398f85; font: inherit; background: none; border: 0; cursor: pointer; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 14px; margin-top: 18px; color: #8d9da5; font-size: 11px; }
.pagination button { padding: 6px 10px; color: #587580; background: #fff; border: 1px solid #d9e7e9; border-radius: 5px; cursor: pointer; }
.pagination button:disabled { color: #bec9cc; cursor: not-allowed; }
.history-details { color: #526f7b; }
/* 详情元数据用两列对照布局，ID 允许折行，避免超长标识撑破弹窗。 */
.history-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 22px; margin: 0; padding: 16px 0; border-bottom: 1px solid #edf2f3; }
.history-meta div { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; }
.history-meta dt { color: #9aa8ae; }
.history-meta dd { margin: 0; overflow-wrap: anywhere; text-align: right; }
.history-content { margin-top: 18px; }
.history-content > span { color: #72878f; font-size: 12px; font-weight: 600; }
/* 完整消息保持用户换行且允许长行折返，最大高度限制为半屏并在内容区内部纵向滚动。 */
.history-content pre { max-height: 50vh; margin: 8px 0 0; padding: 15px; overflow-y: auto; color: #526975; font: inherit; font-size: 13px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; background: #f8fbfb; border: 1px solid #e3edef; border-radius: 6px; }
/* 小屏仅调整筛选与详情元数据的排列和面板留白，不改变查询、分页及详情的交互流程。 */
@media (max-width: 900px) { .query-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .query-grid, .history-meta { grid-template-columns: 1fr; }.query-panel, .table-panel { padding: 16px; }.table-heading { align-items: flex-start; flex-direction: column; gap: 8px; } }
</style>
