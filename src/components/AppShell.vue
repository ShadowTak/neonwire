<script setup>
import { ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import UserAvatar from './UserAvatar.vue'
import { auth, logout } from '../store.js'
import { compact } from '../utils.js'

defineProps({ title: { type: String, default: '' } })

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
  { to: { name: 'feed' }, icon: '⚡', label: 'ฟีด' },
  { to: { name: 'explore' }, icon: '🛰', label: 'สำรวจ' },
  { to: { name: 'me' }, icon: '◉', label: 'โปรไฟล์' },
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
  <div class="shell">
    <aside class="sidebar">
      <RouterLink class="logo" :to="{ name: 'feed' }">
        <span class="logo-mark">⚡</span>
        <span>
          <span class="logo-text">Pulse</span>
          <span class="logo-sub">// social grid</span>
        </span>
      </RouterLink>

      <nav class="nav">
        <RouterLink v-for="item in nav" :key="item.label" class="nav-item" :to="item.to">
          <span class="nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-foot">
        <div class="stat-grid">
          <div class="stat">
            <b>{{ compact(auth.stats?.posts) }}</b>
            <span class="kicker">โพสต์</span>
          </div>
          <div class="stat">
            <b>{{ compact(auth.stats?.likes) }}</b>
            <span class="kicker">ไลก์</span>
          </div>
        </div>

        <div class="me-card">
          <UserAvatar :name="auth.user?.username" :accent="auth.user?.accent" size="sm" />
          <div style="flex: 1; min-width: 0">
            <div class="me-name">{{ auth.user?.username }}</div>
            <div class="mono dim" style="font-size: 9px">{{ auth.user?.email }}</div>
          </div>
        </div>

        <button class="btn btn-ghost btn-sm btn-block" type="button" @click="signOut">ออกจากระบบ</button>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <span class="topbar-title">{{ title || '// pulse' }}</span>
        <form class="search" @submit.prevent="search">
          <input v-model="term" class="input" type="search" placeholder="ค้นหาโพสต์…" aria-label="ค้นหาโพสต์" />
        </form>
      </header>

      <main class="content">
        <slot />
      </main>
    </div>
  </div>

  <nav class="tabbar">
    <RouterLink v-for="item in nav" :key="item.label" :to="item.to">
      <i>{{ item.icon }}</i>
      <span>{{ item.label }}</span>
    </RouterLink>
    <a href="#" @click.prevent="signOut">
      <i>⏻</i>
      <span>ออก</span>
    </a>
  </nav>
</template>
