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
  <AppShell title="สำรวจ">
    <form class="card card-pad search-panel" role="search" @submit.prevent="run(term.trim())">
      <input
        v-model="term"
        class="input"
        type="search"
        placeholder="ค้นหาโพสต์หรือชื่อผู้ใช้…"
        aria-label="คำค้นหา"
      />
      <p class="hint">{{ term ? `ผลลัพธ์สำหรับ “${term}”` : 'แสดงโพสต์ล่าสุดทั้งหมด' }}</p>
    </form>

    <template v-if="loading">
      <div v-for="n in 3" :key="n" class="skeleton" />
    </template>

    <template v-else>
      <section v-if="users.length" class="card card-pad">
        <div class="section-label">ผู้ใช้ที่พบ {{ users.length }} คน</div>
        <div class="user-list">
          <RouterLink
            v-for="user in users"
            :key="user.id"
            class="user-row"
            :to="{ name: 'user', params: { id: user.id } }"
          >
            <UserAvatar :name="user.username" :accent="user.accent" size="sm" />
            <div>
              <div class="post-name">{{ user.username }}</div>
              <div class="user-row-bio">{{ user.bio || 'ยังไม่มีแนะนำตัว' }}</div>
            </div>
            <span class="muted">→</span>
          </RouterLink>
        </div>
      </section>

      <template v-if="posts.length">
        <div class="section-label">โพสต์ที่พบ {{ compact(posts.length) }} รายการ</div>
        <PostCard
          v-for="post in posts"
          :key="post.id"
          :post="post"
          @changed="onChanged"
          @removed="onRemoved"
        />
      </template>

      <div v-else-if="searched" class="card empty">
        <div class="empty-glyph">∅</div>
        <p class="empty-title">ไม่พบผลลัพธ์</p>
        <p class="muted">ลองใช้คำค้นอื่น หรือกลับไปดูฟีดรวม</p>
      </div>
    </template>
  </AppShell>
</template>
