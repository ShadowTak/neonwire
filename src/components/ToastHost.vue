<script setup>
import { toasts, dismissToast } from '../toast.js'
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <div v-for="item in toasts" :key="item.id" class="toast" :class="item.tone" @click="dismissToast(item.id)">
      <span class="toast-dot" />
      <span>{{ item.message }}</span>
    </div>
  </div>
</template>
