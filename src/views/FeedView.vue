<script setup>
import { computed, onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import PostCard from '../components/PostCard.vue'
import PostComposer from '../components/PostComposer.vue'
import { api } from '../api.js'
import { refreshProfile, token } from '../store.js'
import { toast } from '../toast.js'

const posts = ref([])
const loading = ref(true)
const scope = ref('all')

const scopes = [
  { value: 'all', label: 'ฟีดรวม' },
  { value: 'mine', label: 'โพสต์ของฉัน' },
]

const headline = computed(() => (scope.value === 'mine' ? 'โพสต์ของฉัน' : 'ฟีดรวม'))

async function load() {
  loading.value = true
  try {
    const data = await api.posts(token(), { scope: scope.value })
    posts.value = data.posts
  } catch (error) {
    toast.error(error.message)
  } finally {
    loading.value = false
  }
}

function setScope(value) {
  if (scope.value === value) return
  scope.value = value
  load()
}

function onCreated(post) {
  posts.value.unshift(post)
}

function onChanged(updated) {
  const index = posts.value.findIndex((item) => item.id === updated.id)
  if (index >= 0) posts.value[index] = updated
}

function onRemoved(id) {
  posts.value = posts.value.filter((item) => item.id !== id)
  refreshProfile().catch(() => {})
}

onMounted(load)
</script>

<template>
  <AppShell :title="headline">
    <PostComposer @created="onCreated" />

    <div class="chips" role="group" aria-label="เลือกฟีด">
      <button
        v-for="item in scopes"
        :key="item.value"
        class="chip"
        :class="{ on: scope === item.value }"
        type="button"
        :aria-pressed="scope === item.value"
        @click="setScope(item.value)"
      >
        {{ item.label }}
      </button>
      <span class="spacer" />
      <button class="chip" type="button" @click="load">รีเฟรช</button>
    </div>

    <template v-if="loading">
      <div v-for="n in 3" :key="n" class="skeleton" />
    </template>

    <div v-else-if="!posts.length" class="card empty">
      <div class="empty-glyph">◌</div>
      <p class="empty-title">ยังไม่มีโพสต์</p>
      <p class="muted">
        {{ scope === 'mine' ? 'คุณยังไม่ได้โพสต์อะไร เริ่มจากกล่องด้านบนได้เลย' : 'ยังไม่มีโพสต์ในระบบ เป็นคนแรกที่เริ่มต้น' }}
      </p>
    </div>

    <template v-else>
      <PostCard
        v-for="post in posts"
        :key="post.id"
        :post="post"
        @changed="onChanged"
        @removed="onRemoved"
      />
    </template>
  </AppShell>
</template>
