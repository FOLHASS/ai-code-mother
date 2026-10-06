<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow: string
    title: string
    description: string
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
  display: flex;
  align-items: center;
  gap: 20px;
  flex: 0 0 auto;
}

@media (max-width: 700px) {
  .page-header {
    flex-direction: column;
  }

  .page-header__actions {
    align-items: flex-start;
  }
}
</style>
