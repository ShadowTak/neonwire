<script setup>
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import PostCard from '../components/PostCard.vue'
import UserAvatar from '../components/UserAvatar.vue'
import { api } from '../api.js'
import { token } from '../store.js'
import { toast } from '../toast.js'
import { compact } from '../utils.js'

const route = useRoute()

const term = ref(String(route.query.q ?? ''))
const posts = ref([])
const users = ref([])
const loading = ref(false)
const searched = ref(false)

function onChanged(updated) {
  const index = posts.value.findIndex((item) => item.id === updated.id)
  if (index >= 0) posts.value[index] = updated
}

function onRemoved(id) {
  posts.value = posts.value.filter((item) => item.id !== id)
}

async function run(query) {
  loading.value = true
  searched.value = true
  try {
    const [postData, userData] = await Promise.all([
      api.posts(token(), { q: query }),
      query ? api.searchUsers(token(), query) : Promise.resolve({ users: [] }),
    ])
    posts.value = postData.posts
    users.value = userData.users
  } catch (error) {
    toast.error(error.message)
  } finally {
    loading.value = false
  }
}

onMounted(() => run(term.value))

watch(
  () => route.query.q,
  (value) => {
    term.value = value ? String(value) : ''
    run(term.value)
  },
)
</script>

<template>
  <AppShell title="// สำรวจ">
    <section class="panel panel-pad">
      <div class="composer-head">
        <span class="kicker">// ค้นหาบนกริด</span>
        <span class="mono dim">{{ term ? `ผลลัพธ์สำหรับ "${term}"` : 'แสดงโพสต์ล่าสุดทั้งหมด' }}</span>
      </div>
      <form @submit.prevent="run(term.trim())">
        <input v-model="term" class="input" type="search" placeholder="พิมพ์คำที่ต้องการค้นหาแล้วกด Enter…" />
      </form>
    </section>

    <template v-if="loading">
      <div v-for="n in 3" :key="n" class="skeleton" />
    </template>

    <template v-else>
      <section v-if="users.length" class="panel panel-pad">
        <div class="kicker" style="margin-bottom: 12px">// ผู้ใช้ที่พบ ({{ users.length }})</div>
        <div style="display: flex; flex-direction: column; gap: 8px">
          <RouterLink
            v-for="user in users"
            :key="user.id"
            class="user-row"
            :to="{ name: 'user', params: { id: user.id } }"
          >
            <UserAvatar :name="user.username" :accent="user.accent" size="sm" />
            <div style="flex: 1; min-width: 0">
              <div class="post-author">{{ user.username }}</div>
              <div class="mono dim" style="font-size: 10px">{{ user.bio || 'ยังไม่มี bio' }}</div>
            </div>
            <span class="mono dim">→</span>
          </RouterLink>
        </div>
      </section>

      <template v-if="posts.length">
        <div class="kicker">// โพสต์ที่พบ ({{ compact(posts.length) }})</div>
        <PostCard
          v-for="post in posts"
          :key="post.id"
          :post="post"
          @changed="onChanged"
          @removed="onRemoved"
        />
      </template>

      <div v-else-if="searched" class="panel empty">
        <div class="empty-mark">∅</div>
        <p class="title">ไม่พบผลลัพธ์</p>
        <p class="muted">ลองใช้คำค้นอื่น หรือกลับไปดูฟีดรวม</p>
      </div>
    </template>
  </AppShell>
</template>
