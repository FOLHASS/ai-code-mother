<script setup lang="ts">
import type { AppSummary } from '@/shared/domain/models.ts'
/**
 * 应用标题浮层中的详情展示：复用详情接口 AppVO 及其关联 user 信息，避免再次请求。
 * 创建者、生成类型、部署状态等字段采用共享格式化函数；删除仅作为有权限时的事件出口。
 * 底部“查看作品”使用已部署地址，不与 iframe 中的生成文件预览地址混用。
 */
import { computed } from 'vue'

import UserAvatar from '@/components/UserAvatar.vue'
import { formatDateTime, getDeployUrl } from '@/utils/app.ts'
import { formatCodeGenType } from '@/utils/codeGenTypes.ts'

/** app 为当前应用详情；deployedUrl 优先采用本次部署返回值；canDelete 由父层结合权限和生成状态计算。 */
const props = defineProps<{
  app: AppSummary
  deployedUrl: string
  canDelete: boolean
}>()

/** 只表达删除意图，确认框、调用接口和成功后的导航全部由页面负责。 */
const emit = defineEmits<{
  delete: []
}>()

// 作者展示按昵称、账号、未知创作者依次回退，头像组件同步使用同一展示名称。
const creatorName = computed(
  () => props.app.user?.userName?.trim() || props.app.user?.userAccount?.trim() || '未知创作者',
)

// 使用统一生成类型枚举的标签；缺失生成类型时保留“尚未生成”的业务含义。
const generationType = computed(() =>
  props.app.codeGenType ? formatCodeGenType(props.app.codeGenType) : '尚未生成',
)
// 已部署地址可能来自刚完成的部署；否则根据应用保存的 deployKey 与全局部署域名生成。
const workUrl = computed(() => props.deployedUrl || getDeployUrl(props.app))
</script>

<template>
  <section class="app-info" aria-label="应用基础信息">
    <h2>基础信息</h2>
    <dl class="app-info__grid">
      <div class="app-info__item">
        <dt>创建者</dt>
        <dd class="app-info__creator">
          <UserAvatar :avatar="app.user?.userAvatar" :name="creatorName" size="sm" />
          <span :title="creatorName">{{ creatorName }}</span>
        </dd>
      </div>
      <div class="app-info__item">
        <dt>创建时间</dt>
        <dd>{{ formatDateTime(app.createTime) }}</dd>
      </div>
      <div class="app-info__item">
        <dt>生成类型</dt>
        <dd>{{ generationType }}</dd>
      </div>
      <div class="app-info__item">
        <dt>部署状态</dt>
        <dd>{{ workUrl ? '已部署' : '未部署' }}</dd>
      </div>
      <div class="app-info__item">
        <dt>精选案例</dt>
        <dd>{{ app.priority === 99 ? '是' : '否' }}</dd>
      </div>
      <div class="app-info__item">
        <dt>部署时间</dt>
        <dd>{{ formatDateTime(app.deployedTime) }}</dd>
      </div>
    </dl>
    <div class="app-info__footer">
      <div class="app-info__id" :title="String(app.id || '')">应用 ID：{{ app.id || '-' }}</div>
      <div v-if="workUrl || canDelete" class="app-info__actions">
        <a
          v-if="workUrl"
          class="app-info__view"
          :href="workUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          查看作品 <span aria-hidden="true">↗</span>
        </a>
        <button v-if="canDelete" type="button" class="app-info__delete" @click="emit('delete')">
          删除作品
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.app-info {
  width: min(360px, calc(100vw - 48px));
  color: #263844;
}
.app-info h2 {
  margin: 0 0 18px;
  color: #1c303e;
  font-size: 16px;
  font-weight: 700;
}
/* 详情采用双列键值布局，单元格允许收缩，长昵称和时间不会撑开浮层。 */

.app-info__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 19px 22px;
  margin: 0;
}
.app-info__item {
  min-width: 0;
}
.app-info__item dt {
  margin-bottom: 8px;
  color: #8999a5;
  font-size: 12px;
}
.app-info__item dd {
  min-height: 30px;
  margin: 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 30px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-info__creator {
  display: flex;
  align-items: center;
  gap: 8px;
}
.app-info__creator span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-info__footer {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 13px;
  margin-top: 21px;
  padding-top: 17px;
  border-top: 1px solid #edf0f2;
}
.app-info__id {
  max-width: 100%;
  overflow: hidden;
  color: #8999a5;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 桌面默认隐藏操作，但仍保留网格位置；悬浮或键盘焦点进入时一起展示左右按钮。 */

.app-info__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}
/* focus-within 使键盘导航获得与鼠标悬浮一致的操作可见性。 */

.app-info:hover .app-info__actions,
.app-info:focus-within .app-info__actions {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}
.app-info__actions a,
.app-info__actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 6px 10px;
  font: inherit;
  font-size: 13px;
  text-decoration: none;
  border: 1px solid #dfe9ec;
  border-radius: 9px;
  cursor: pointer;
  transition:
    color 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease;
}
.app-info__actions a:focus-visible,
.app-info__actions button:focus-visible {
  outline: 2px solid #198979;
  outline-offset: 2px;
}
.app-info__view {
  grid-column: 1;
  color: #23786f;
  background: #f3faf8;
}
.app-info__view:hover {
  color: #14675e;
  background: #e8f6f2;
  border-color: #a9d8cc;
}
.app-info__actions .app-info__delete {
  grid-column: 2;
  color: #dd5260;
  background: #fff7f7;
  border-color: #f4dada;
}
.app-info__actions .app-info__delete:hover {
  color: #bb3343;
  background: #fff0f1;
  border-color: #efb5bc;
}
/* 无悬浮能力的触屏直接显示操作，避免按钮无法被发现或点击。 */

@media (hover: none) {
  .app-info__actions {
    opacity: 1;
    pointer-events: auto;
    transform: none;
  }
}
/* 尊重系统减少动态效果的偏好，取消操作区淡入和位移动画。 */

@media (prefers-reduced-motion: reduce) {
  .app-info__actions,
  .app-info__actions a,
  .app-info__actions button {
    transition: none;
  }
}
</style>
