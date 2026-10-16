<script setup lang="ts">
/**
 * 管理页和资料页共用的标题区域：上方英文眉题、主标题、说明，以及可选的右侧操作插槽。
 * 只负责展示，不获取数据、不处理按钮动作；actions 插槽由使用它的页面自行组织。
 */
withDefaults(
  defineProps<{
    /** 标题上方的小号说明文字。 */
    eyebrow: string
    /** 页面主要标题，模板使用 h1 表达主标题层级。 */
    title: string
    /** 解释当前页面用途或操作范围。 */
    description: string
    /** 仅改变眉题色调，默认蓝色；不影响页面业务状态。 */
    tone?: 'blue' | 'teal'
  }>(),
  {
    tone: 'blue',
  },
)
</script>

<template>
  <header class="page-header" :class="`page-header--${tone}`">
    <div>
      <p class="page-header__eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p class="page-header__description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
/* 标题与操作区分列展示；操作区是否存在由 actions 插槽是否提供决定。 */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.page-header__eyebrow {
  margin: 0 0 8px;
  color: #3478d4;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.14em;
}

.page-header--teal .page-header__eyebrow {
  color: #319e8e;
}

.page-header h1 {
  margin: 0 0 8px;
  color: #152b46;
  font-size: 30px;
  line-height: 1.2;
}

.page-header__description {
  margin: 0;
  color: #728196;
  font-size: 13px;
}

.page-header__actions {
  /* 操作区保持自身宽度，避免被长标题压缩；按钮的行为仍归页面所有。 */
  display: flex;
  align-items: center;
  gap: 20px;
  flex: 0 0 auto;
}

@media (max-width: 700px) {
  /* 窄屏让操作区下移，防止标题说明和按钮在一行内相互挤压。 */
  .page-header {
    flex-direction: column;
  }

  .page-header__actions {
    align-items: flex-start;
  }
}
</style>
