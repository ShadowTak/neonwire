<script setup>
import { RouterView } from 'vue-router'
import ToastHost from './components/ToastHost.vue'
</script>

<template>
  <div class="bg" />
  <div class="bg-scan" />

  <RouterView v-slot="{ Component }">
    <component :is="Component" />
  </RouterView>

  <ToastHost />
</template>
