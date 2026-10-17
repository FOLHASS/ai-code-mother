<script setup lang="ts">
import { useLoginUserStore } from '@/stores/loginUserStore.ts'
const session = useLoginUserStore()
</script>

<template>
  <aside v-if="session.status === 'error'" class="session-notice" role="status">
    <span>暂时无法确认登录状态，请检查网络后重试。</span>
    <button type="button" @click="session.fetchLoginUser(true)">重试</button>
  </aside>
</template>

<style scoped>
.session-notice {
  display: flex;
  gap: 16px;
  justify-content: center;
  padding: 10px 16px;
  color: #755715;
  background: #fff8e5;
  font-size: 13px;
}
.session-notice button {
  padding: 0;
  color: inherit;
  font: inherit;
  text-decoration: underline;
  border: 0;
  background: transparent;
  cursor: pointer;
}
</style>
