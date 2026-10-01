<script setup lang="ts">
import BasicLayout from '@/layouts/BasicLayout.vue'
import { health } from '@/api/healthController.ts'

health().then((value) => {
  const { data } = value
  console.log(data.data)
})
</script>

<template>
  <BasicLayout />
</template>
