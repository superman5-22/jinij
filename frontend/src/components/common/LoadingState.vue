<template>
  <div class="loading-state">
    <div class="spinner"></div>
    <span style="font-size:0.82rem">{{ message }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ message?: string }>()
</script>
