<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: '?' },
  accent: { type: String, default: 'cyan' },
  size: { type: String, default: 'md' },
})

const initials = computed(() => (props.name || '?').trim().slice(0, 2))
const sizeClass = computed(() => (props.size === 'sm' ? 'avatar-sm' : props.size === 'lg' ? 'avatar-lg' : ''))
</script>

<template>
  <div class="avatar" :class="[`accent-${accent}`, sizeClass]" aria-hidden="true">{{ initials }}</div>
</template>
