<script setup lang="ts">
import { FEATURED_PRIORITY } from '@/shared/domain/constants.ts'
/**
 * 应用管理页面向管理员：多条件分页查询全部应用，查看详情、进入对话、编辑、精选及删除。
 * 列表控制器持有分页、筛选和弹窗目标；编辑保存后刷新当前列表，不离开管理页面。
 * 生成类型的选项与中文文案取自公共枚举配置，避免管理筛选与其他页面出现不同的取值表。
 */
import { AppCover, AppDetailsModal, AppEditModal } from '@/features/app-management/components'
import PageHeader from '@/components/PageHeader.vue'
import PageStat from '@/components/PageStat.vue'
import { useAdminAppManageControllers } from '@/app/controllers.ts'
import { formatDate } from '@/utils/app.ts'
import { CODE_GEN_TYPE_OPTIONS, formatCodeGenType } from '@/utils/codeGenTypes.ts'

const { controller, editController } = useAdminAppManageControllers()
const {
  isLoading,
  currentPage,
  pageSize,
  total,
  apps,
  selectedApp,
  showDetailsModal,
  showEditModal,
  setDetailsOpen,
  searchForm,
  isAdmin,
  totalPages,
  search,
  reset,
  changePage,
  featureApp,
  removeApp,
  openDetails,
  openApp,
  editApp,
} = controller
// 模板依次组合页头统计、筛选面板、表格与分页、应用详情弹窗。
// 表格按加载/无数据/记录三种状态渲染；已精选项隐藏“精选”按钮，部署状态仅根据 deployKey 展示。
// 详情和表格共用编辑命令；编辑弹窗保存后保留当前筛选和页码。
</script>

<template>
  <section v-if="isAdmin" class="app-manage-page">
    <PageHeader
      eyebrow="ADMIN CONSOLE"
      title="应用管理"
      description="查看、筛选和维护平台上的全部应用。"
    >
      <template #actions><PageStat :value="total" label="应用总数" /></template>
    </PageHeader>
    <section class="query-panel">
      <div class="query-grid">
        <label
          ><span>应用 ID</span
          ><input v-model="searchForm.id" type="text" inputmode="numeric" placeholder="应用 ID"
        /></label>
        <label
          ><span>应用名称</span
          ><input v-model="searchForm.appName" type="text" placeholder="输入名称关键词"
        /></label>
        <label
          ><span>封面地址</span
          ><input v-model="searchForm.cover" type="text" placeholder="输入封面地址"
        /></label>
        <label
          ><span>用户 ID</span
          ><input
            v-model="searchForm.userId"
            type="text"
            inputmode="numeric"
            placeholder="创建者 ID"
        /></label>
        <label
          ><span>优先级</span
          ><input v-model.number="searchForm.priority" type="number" min="0" placeholder="如 99"
        /></label>
        <label
          ><span>生成类型</span
          ><select v-model="searchForm.codeGenType">
            <option value="">全部类型</option>
            <option
              v-for="option in CODE_GEN_TYPE_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select></label
        >
        <label
          ><span>部署标识</span
          ><input v-model="searchForm.deployKey" type="text" placeholder="部署标识"
        /></label>
      </div>
      <label class="prompt-filter"
        ><span>初始需求</span
        ><input v-model="searchForm.initPrompt" type="text" placeholder="搜索初始需求内容"
      /></label>
      <div class="query-actions">
        <button class="secondary-button" type="button" @click="reset">重置</button
        ><button class="primary-button" type="button" :disabled="isLoading" @click="search">
          {{ isLoading ? '查询中...' : '查询应用' }}
        </button>
      </div>
    </section>

    <section class="table-panel">
      <div class="table-heading">
        <div>
          <h2>全部应用</h2>
          <span>共 {{ total }} 条记录</span>
        </div>
        <span>管理员可以编辑任意应用</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>应用</th>
              <th>创建者</th>
              <th>生成类型</th>
              <th>优先级</th>
              <th>部署状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="7" class="empty-cell">正在加载应用数据...</td>
            </tr>
            <tr v-else-if="!apps.length">
              <td colspan="7" class="empty-cell">暂无符合条件的应用</td>
            </tr>
            <tr v-for="app in apps" v-else :key="app.id">
              <td>
                <div class="app-cell">
                  <AppCover :app="app" size="table" />
                  <div>
                    <strong>{{ app.appName || '未命名应用' }}</strong
                    ><small>#{{ app.id }}</small>
                  </div>
                </div>
              </td>
              <td>
                <div class="owner-cell">
                  <span>{{ app.user?.userName || '用户 #' + (app.userId || '-') }}</span
                  ><small>ID {{ app.userId || '-' }}</small>
                </div>
              </td>
              <td>
                <span class="type-badge">{{
                  app.codeGenType ? formatCodeGenType(app.codeGenType) : '-'
                }}</span>
              </td>
              <td>
                <span class="priority-badge" :class="{ featured: app.priority === 99 }">{{
                  app.priority === 99 ? '精选' : (app.priority ?? 0)
                }}</span>
              </td>
              <td>
                <span class="deploy-state" :class="{ deployed: app.deployKey }"
                  ><i></i>{{ app.deployKey ? '已部署' : '未部署' }}</span
                >
              </td>
              <td class="date-cell">{{ formatDate(app.createTime) }}</td>
              <td>
                <div class="action-buttons">
                  <button type="button" @click="openDetails(app)">详情</button
                  ><button type="button" @click="openApp(app)">查看</button
                  ><button type="button" @click="editApp(app)">编辑</button
                  ><button
                    v-if="app.priority !== FEATURED_PRIORITY"
                    type="button"
                    @click="featureApp(app)"
                  >
                    精选</button
                  ><button class="danger" type="button" @click="removeApp(app)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="total > pageSize" class="pagination">
        <button
          type="button"
          :disabled="currentPage <= 1 || isLoading"
          @click="changePage(currentPage - 1)"
        >
          上一页</button
        ><span>第 {{ currentPage }} / {{ totalPages }} 页</span
        ><button
          type="button"
          :disabled="currentPage >= totalPages || isLoading"
          @click="changePage(currentPage + 1)"
        >
          下一页
        </button>
      </div>
    </section>

    <AppDetailsModal
      :open="showDetailsModal"
      @update:open="setDetailsOpen"
      :app="selectedApp"
      @open-app="openApp"
      @edit-app="editApp"
    />
    <AppEditModal :open="showEditModal" :controller="editController" />
  </section>
</template>

<style scoped>
/* 管理页与用户管理页保持居中、有限最大宽度的面板布局；可横向滚动的表格保留列可读性。 */
.app-manage-page {
  width: min(1280px, calc(100% - 48px));
  margin: 0 auto;
  color: var(--color-text-primary);
}
/* 筛选区默认四列，表格固定最小宽度以容纳作者、部署和操作列；外层 table-wrap 承担横向滚动。
 * 行内徽标区分生成类型、精选优先级与部署状态，危险操作仅改变文字色，不改变按钮位置。
 * 操作区和分页维持紧凑排布；按钮禁用样式用于说明加载中或到达分页边界。
 */
.query-panel,
.table-panel {
  padding: 22px;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: 0 7px 24px rgb(34 82 105 / 4%);
}
.query-panel {
  margin-bottom: 18px;
}
.query-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.query-grid label,
.prompt-filter {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.query-grid span,
.prompt-filter span {
  color: #647b87;
  font-size: 12px;
  font-weight: 600;
}
.query-grid input,
.query-grid select,
.prompt-filter input {
  min-height: 37px;
  padding: 0 10px;
  color: #405966;
  font: inherit;
  font-size: 12px;
  background: #fbfdfd;
  border: 1px solid #dbe7e9;
  border-radius: 6px;
  outline: 0;
}
.prompt-filter {
  margin-top: 14px;
}
.query-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 17px;
}
.primary-button,
.secondary-button {
  min-height: 36px;
  padding: 0 14px;
  font: inherit;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
}
.primary-button {
  color: #fff;
  background: #258f84;
  border: 1px solid #258f84;
}
.secondary-button {
  color: #5d7480;
  background: #fff;
  border: 1px solid #d6e4e8;
}
.table-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 18px;
}
.table-heading h2 {
  margin: 0 0 5px;
  color: #203a4f;
  font-size: 18px;
}
.table-heading span {
  color: #98a7ae;
  font-size: 11px;
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  min-width: 850px;
  border-collapse: collapse;
}
th {
  padding: 11px 9px;
  color: #91a0a7;
  font-size: 11px;
  font-weight: 650;
  text-align: left;
  background: #f8fbfb;
  border-bottom: 1px solid #e3edef;
}
td {
  padding: 13px 9px;
  color: #54707c;
  font-size: 12px;
  border-bottom: 1px solid #eff3f4;
}
tbody tr:hover {
  background: #fbfdfd;
}
.app-cell,
.owner-cell {
  display: flex;
  align-items: center;
  gap: 9px;
}
.app-cell strong,
.owner-cell span {
  display: block;
  color: #294454;
  font-size: 12px;
}
.app-cell small,
.owner-cell small {
  display: block;
  margin-top: 4px;
  color: #a0adb2;
  font-size: 10px;
}
.type-badge,
.priority-badge {
  display: inline-block;
  padding: 5px 7px;
  font-size: 10px;
  background: #f2f7f8;
  border-radius: 5px;
}
.priority-badge.featured {
  color: #8a6a20;
  background: #fff3d0;
}
.deploy-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #a0adb1;
  font-size: 11px;
}
.deploy-state i {
  width: 6px;
  height: 6px;
  background: #c4d0d2;
  border-radius: 50%;
}
.deploy-state.deployed {
  color: #31947f;
}
.deploy-state.deployed i {
  background: #36b68c;
}
.date-cell {
  white-space: nowrap;
}
.action-buttons {
  display: flex;
  gap: 10px;
}
.action-buttons button {
  padding: 0;
  color: #398f85;
  font: inherit;
  font-size: 11px;
  background: none;
  border: 0;
  cursor: pointer;
}
.action-buttons button.danger {
  color: #bd6a72;
}
.empty-cell {
  padding: 46px 10px;
  color: #a0adb3;
  text-align: center;
}
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  margin-top: 18px;
  color: #8d9da5;
  font-size: 11px;
}
.pagination button {
  padding: 6px 10px;
  color: #587580;
  background: #fff;
  border: 1px solid #d9e7e9;
  border-radius: 5px;
  cursor: pointer;
}
.pagination button:disabled {
  color: #bec9cc;
  cursor: not-allowed;
}
/* 平板筛选降为两列；手机降为单列并缩小面板内边距，表格仍通过外层滚动访问全部字段。 */
@media (max-width: 900px) {
  .query-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .page-header {
    flex-direction: column;
  }
  .query-grid {
    grid-template-columns: 1fr;
  }
  .query-panel,
  .table-panel {
    padding: 16px;
  }
  .table-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }
}
</style>
