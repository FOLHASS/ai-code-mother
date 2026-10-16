<script setup lang="ts">
/** 小型统计展示单元，通常放在页面标题右侧；数值由父页面计算，本组件不请求接口。 */
defineProps<{
  /** 支持原始数字或父级已格式化的文本，例如总记录数。 */
  value: string | number
  /** 数值对应的业务含义，例如“应用总数”。 */
  label: string
}>()
</script>

<template>
  <div class="page-stat">
    <strong>{{ value }}</strong>
    <span>{{ label }}</span>
  </div>
</template>

<style scoped>
/* 左侧分隔线把统计与相邻标题/操作隔开；上下排列强调数值，再补充说明。 */
.page-stat {
  display: flex;
  flex-direction: column;
  min-width: 110px;
  padding-left: 20px;
  border-left: 1px solid #dce7f2;
}

.page-stat strong {
  color: #2679d9;
  font-size: 28px;
  line-height: 1.1;
}

.page-stat span {
  margin-top: 5px;
  color: #8291a4;
  font-size: 12px;
}

@media (max-width: 700px) {
  /* 在窄屏减小统计单元的保留宽度，与 PageHeader 的纵向布局配合。 */
  .page-stat {
    min-width: 76px;
    padding-left: 12px;
  }
}
</style>
