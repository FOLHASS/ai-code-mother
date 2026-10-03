<script setup lang="ts">
import { useLoginUserStore } from '@/stores/loginUserStore.ts'

const loginUserStore = useLoginUserStore()
void loginUserStore.fetchLoginUser()
</script>

<template>
  <RouterView />
</template>
