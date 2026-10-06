<script setup lang="ts">
defineProps<{
  value: string | number
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
  .page-stat {
    min-width: 76px;
    padding-left: 12px;
  }
}
</style>
