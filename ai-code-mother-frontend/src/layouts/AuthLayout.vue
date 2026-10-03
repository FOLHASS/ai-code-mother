<script setup lang="ts">
import { Layout } from 'ant-design-vue'
</script>

<template>
  <Layout class="auth-layout">
    <RouterView />
  </Layout>
</template>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  min-width: 320px;
  min-height: 100%;
  margin: 0;
}

:global(body) {
  background: #f7faff;
}

.auth-layout {
  min-height: 100vh;
  background: #f7faff;
}
</style>
