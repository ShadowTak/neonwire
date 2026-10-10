<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import PostCard from '../components/PostCard.vue'
import PostComposer from '../components/PostComposer.vue'
import UserAvatar from '../components/UserAvatar.vue'
import { api } from '../api.js'
import { auth, refreshProfile, token } from '../store.js'
import { toast } from '../toast.js'
import { compact } from '../utils.js'

const ACCENTS = ['cyan', 'magenta', 'lime', 'violet', 'amber']

const route = useRoute()
const loading = ref(true)
const saving = ref(false)
const posts = ref([])
const profile = ref(null)
const stats = ref({ posts: 0, likes: 0 })
const editing = ref(false)
const form = reactive({ username: '', bio: '', accent: 'cyan' })

const targetId = computed(() => (route.name === 'me' ? auth.user?.id : Number(route.params.id)))
const isMe = computed(() => Boolean(auth.user && targetId.value === auth.user.id))
const title = computed(() => (isMe.value ? '// โปรไฟล์ของฉัน' : `// @${profile.value?.username ?? '…'}`))

const dirty = computed(() => {
  if (!profile.value) return false
  return (
    form.username.trim() !== profile.value.username ||
    form.bio.trim() !== (profile.value.bio || '') ||
    form.accent !== profile.value.accent
  )
})

function onChanged(updated) {
  const index = posts.value.findIndex((item) => item.id === updated.id)
  if (index >= 0) posts.value[index] = updated
}

function onRemoved(id) {
  posts.value = posts.value.filter((item) => item.id !== id)
  stats.value = { ...stats.value, posts: Math.max(0, stats.value.posts - 1) }
  refreshProfile().catch(() => {})
}

function onCreated(post) {
  posts.value.unshift(post)
  stats.value = { ...stats.value, posts: stats.value.posts + 1 }
}

function startEdit() {
  form.username = profile.value.username
  form.bio = profile.value.bio || ''
  form.accent = profile.value.accent
  editing.value = true
}

async function save() {
  if (!dirty.value || saving.value) return
  saving.value = true
  try {
    const data = await api.updateMe(token(), {
      username: form.username.trim(),
      bio: form.bio.trim(),
      accent: form.accent,
    })
    profile.value = { ...profile.value, ...data.user }
    stats.value = data.stats
    editing.value = false
    await refreshProfile()
    toast.ok('อัปเดตโปรไฟล์แล้ว')
  } catch (error) {
    toast.error(error.message)
  } finally {
    saving.value = false
  }
}

async function load() {
  if (!auth.user) return
  loading.value = true
  try {
    if (isMe.value) {
      const data = await api.me(token())
      profile.value = data.user
      stats.value = data.stats
      posts.value = (await api.posts(token(), { scope: 'mine' })).posts
    } else {
      const data = await api.user(token(), targetId.value)
      profile.value = data.user
      stats.value = data.stats
      posts.value = data.posts
    }
    form.username = profile.value.username
    form.bio = profile.value.bio || ''
    form.accent = profile.value.accent
    editing.value = false
  } catch (error) {
    toast.error(error.message)
    profile.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => route.params.id, load)
</script>

<template>
  <AppShell :title="title">
    <div v-if="loading" class="skeleton" style="height: 190px" />

    <div v-else-if="!profile" class="panel empty">
      <div class="empty-mark">✕</div>
      <p class="title">ไม่พบผู้ใช้</p>
      <p class="muted">บัญชีนี้อาจถูกลบไปแล้ว</p>
    </div>

    <template v-else>
      <section class="panel panel-hot profile-banner">
        <div class="profile-top">
          <UserAvatar :name="profile.username" :accent="profile.accent" size="lg" />
          <div style="flex: 1; min-width: 180px">
            <div class="kicker">{{ isMe ? '// บัญชีของคุณ' : '// โปรไฟล์สาธารณะ' }}</div>
            <h2 class="title">{{ profile.username }}</h2>
            <p class="muted" style="margin-top: 6px">{{ profile.bio || 'ยังไม่มี bio — เขียนแนะนำตัวสั้น ๆ ได้' }}</p>
            <p v-if="isMe" class="mono dim" style="margin-top: 8px">{{ profile.email }}</p>
          </div>
          <button v-if="isMe && !editing" class="btn btn-sm" type="button" @click="startEdit">แก้ไขโปรไฟล์</button>
        </div>

        <div class="profile-stats">
          <div class="stat">
            <b>{{ compact(stats.posts) }}</b>
            <span class="kicker">โพสต์</span>
          </div>
          <div class="stat">
            <b>{{ compact(stats.likes) }}</b>
            <span class="kicker">ไลก์ที่ได้รับ</span>
          </div>
          <div class="stat">
            <b>{{ compact(posts.reduce((sum, item) => sum + item.commentCount, 0)) }}</b>
            <span class="kicker">ความคิดเห็น</span>
          </div>
        </div>

        <form v-if="editing" class="form-stack" @submit.prevent="save">
          <div class="field">
            <label for="p-name">ชื่อผู้ใช้</label>
            <input id="p-name" v-model="form.username" class="input" maxlength="30" />
          </div>

          <div class="field">
            <label for="p-bio">bio</label>
            <textarea id="p-bio" v-model="form.bio" class="textarea" maxlength="200" rows="2" placeholder="แนะนำตัวสั้น ๆ…" />
            <span class="hint">{{ form.bio.length }}/200</span>
          </div>

          <div class="field">
            <label>สีโปรไฟล์</label>
            <div class="preset-row">
              <button
                v-for="color in ACCENTS"
                :key="color"
                class="swatch"
                :class="[`accent-${color}`, { active: form.accent === color }]"
                type="button"
                :title="color"
                :aria-label="color"
                @click="form.accent = color"
              >
                <i />
              </button>
            </div>
          </div>

          <div style="display: flex; gap: 9px; justify-content: flex-end">
            <button class="btn btn-ghost btn-sm" type="button" @click="editing = false">ยกเลิก</button>
            <button class="btn btn-primary btn-sm" type="submit" :disabled="!dirty || saving">
              {{ saving ? 'กำลังบันทึก…' : 'บันทึกโปรไฟล์' }}
            </button>
          </div>
        </form>
      </section>

      <PostComposer v-if="isMe" @created="onCreated" />

      <div class="kicker">{{ isMe ? '// โพสต์ของฉัน' : `// โพสต์ของ @${profile.username}` }}</div>

      <div v-if="!posts.length" class="panel empty">
        <div class="empty-mark">▓▒░</div>
        <p class="title">ยังไม่มีโพสต์</p>
        <p class="muted">{{ isMe ? 'เริ่มโพสต์แรกของคุณด้านบน' : 'ผู้ใช้รายนี้ยังไม่โพสต์อะไร' }}</p>
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
    </template>
  </AppShell>
</template>
