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
const title = computed(() => (isMe.value ? 'โปรไฟล์ของฉัน' : profile.value?.username ?? 'โปรไฟล์'))

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
    <div v-if="loading" class="skeleton" style="height: 220px" />

    <div v-else-if="!profile" class="card empty">
      <div class="empty-glyph">✕</div>
      <p class="empty-title">ไม่พบผู้ใช้</p>
      <p class="muted">บัญชีนี้อาจถูกลบไปแล้ว</p>
    </div>

    <template v-else>
      <section class="card profile">
        <div class="profile-top">
          <UserAvatar :name="profile.username" :accent="profile.accent" size="lg" />
          <div class="profile-info">
            <h2 class="profile-name">{{ profile.username }}</h2>
            <p class="profile-bio">{{ profile.bio || (isMe ? 'ยังไม่มีแนะนำตัว ลองเขียนสักประโยคสิ' : 'ผู้ใช้รายนี้ยังไม่ได้แนะนำตัว') }}</p>
            <p v-if="isMe" class="profile-mail">{{ profile.email }}</p>
          </div>
          <button v-if="isMe && !editing" class="btn btn-sm" type="button" @click="startEdit">แก้ไขโปรไฟล์</button>
        </div>

        <div class="profile-stats">
          <div>
            <b>{{ compact(stats.posts) }}</b>
            <span>โพสต์</span>
          </div>
          <div>
            <b>{{ compact(stats.likes) }}</b>
            <span>ไลก์ที่ได้รับ</span>
          </div>
          <div>
            <b>{{ compact(posts.reduce((sum, item) => sum + item.commentCount, 0)) }}</b>
            <span>ความคิดเห็น</span>
          </div>
        </div>

        <form v-if="editing" class="form-stack" style="margin-top: 22px" @submit.prevent="save">
          <div class="field">
            <label for="p-name">ชื่อผู้ใช้</label>
            <input id="p-name" v-model="form.username" class="input" maxlength="30" />
          </div>

          <div class="field">
            <label for="p-bio">แนะนำตัว</label>
            <textarea id="p-bio" v-model="form.bio" class="textarea" maxlength="200" rows="2" placeholder="เล่าสั้น ๆ เกี่ยวกับตัวคุณ…" />
            <span class="hint">{{ form.bio.length }}/200</span>
          </div>

          <div class="field">
            <span class="label">สีประจำตัว</span>
            <div class="swatches">
              <button
                v-for="color in ACCENTS"
                :key="color"
                class="swatch"
                :class="[`accent-${color}`, { on: form.accent === color }]"
                type="button"
                :title="color"
                :aria-label="color"
                :aria-pressed="form.accent === color"
                @click="form.accent = color"
              />
            </div>
          </div>

          <div style="display: flex; gap: 8px; justify-content: flex-end">
            <button class="btn btn-ghost btn-sm" type="button" @click="editing = false">ยกเลิก</button>
            <button class="btn btn-primary btn-sm" type="submit" :disabled="!dirty || saving">
              {{ saving ? 'กำลังบันทึก…' : 'บันทึก' }}
            </button>
          </div>
        </form>
      </section>

      <PostComposer v-if="isMe" @created="onCreated" />

      <div class="section-label">{{ isMe ? 'โพสต์ของคุณ' : `โพสต์ของ ${profile.username}` }}</div>

      <div v-if="!posts.length" class="card empty">
        <div class="empty-glyph">◌</div>
        <p class="empty-title">ยังไม่มีโพสต์</p>
        <p class="muted">{{ isMe ? 'เริ่มโพสต์แรกของคุณจากกล่องด้านบน' : 'ผู้ใช้รายนี้ยังไม่ได้โพสต์อะไร' }}</p>
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
