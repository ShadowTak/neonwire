<script setup>
import { ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import UserAvatar from './UserAvatar.vue'
import { auth, logout } from '../store.js'
import { compact } from '../utils.js'

defineProps({ title: { type: String, default: 'ฟีด' } })

const route = useRoute()
const router = useRouter()
const term = ref(String(route.query.q ?? ''))

watch(
  () => route.query.q,
  (value) => {
    term.value = value ? String(value) : ''
  },
)

const nav = [
  { to: { name: 'feed' }, icon: '◐', label: 'ฟีด' },
  { to: { name: 'explore' }, icon: '◌', label: 'สำรวจ' },
  { to: { name: 'me' }, icon: '○', label: 'โปรไฟล์' },
]

function search() {
  const q = term.value.trim()
  router.push({ name: 'explore', query: q ? { q } : {} })
}

function signOut() {
  logout()
  router.push({ name: 'auth' })
}
</script>

<template>
  <div class="app">
    <aside class="side">
      <RouterLink class="brand" :to="{ name: 'feed' }">
        <span class="brand-mark">◎</span>
        <span>Orbit</span>
      </RouterLink>

      <nav class="nav">
        <RouterLink v-for="item in nav" :key="item.label" class="nav-link" :to="item.to">
          <span class="nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="side-foot">
        <div class="stats-inline">
          <div>
            <b>{{ compact(auth.stats?.posts) }}</b>
            โพสต์
          </div>
          <div>
            <b>{{ compact(auth.stats?.likes) }}</b>
            ไลก์
          </div>
        </div>

        <div class="me">
          <UserAvatar :name="auth.user?.username" :accent="auth.user?.accent" size="sm" />
          <div class="me-meta">
            <div class="me-name">{{ auth.user?.username }}</div>
            <div class="me-mail">{{ auth.user?.email }}</div>
          </div>
        </div>

        <button class="btn btn-ghost btn-sm" type="button" @click="signOut">ออกจากระบบ</button>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <span class="topbar-title">{{ title }}</span>
        <form class="search" role="search" @submit.prevent="search">
          <input v-model="term" class="input" type="search" placeholder="ค้นหาโพสต์…" aria-label="ค้นหาโพสต์" />
        </form>
      </header>

      <main class="content">
        <slot />
      </main>
    </div>
  </div>

  <nav class="tabbar" aria-label="เมนูหลัก">
    <RouterLink v-for="item in nav" :key="item.label" :to="item.to">
      <i>{{ item.icon }}</i>
      <span>{{ item.label }}</span>
    </RouterLink>
    <button type="button" @click="signOut">
      <i>⎋</i>
      <span>ออก</span>
    </button>
  </nav>
</template>
