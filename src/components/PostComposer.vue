<script setup>
import { ref } from 'vue'
import UserAvatar from './UserAvatar.vue'
import { api } from '../api.js'
import { auth, refreshProfile, token } from '../store.js'
import { toast } from '../toast.js'

const emit = defineEmits(['created'])
const MAX = 500

const draft = ref('')
const busy = ref(false)

async function submit() {
  const content = draft.value.trim()
  if (!content || busy.value) return

  busy.value = true
  try {
    const data = await api.createPost(token(), content)
    draft.value = ''
    emit('created', data.post)
    toast.ok('โพสต์ของคุณถูกเผยแพร่แล้ว')
    refreshProfile().catch(() => {})
  } catch (error) {
    toast.error(error.message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card composer" aria-label="สร้างโพสต์">
    <UserAvatar :name="auth.user?.username" :accent="auth.user?.accent" />
    <div class="composer-body">
      <textarea
        v-model="draft"
        class="textarea"
        rows="3"
        :maxlength="MAX"
        placeholder="วันนี้มีอะไรอยากบอกคนอื่นบ้าง…"
        aria-label="เนื้อหาโพสต์"
        @keydown.ctrl.enter="submit"
        @keydown.meta.enter="submit"
      />
      <div class="composer-foot">
        <span class="counter" :class="{ warn: draft.length > 430 && draft.length <= MAX, over: draft.length > MAX }">
          {{ draft.length }}/{{ MAX }}
        </span>
        <button class="btn btn-primary btn-sm" type="button" :disabled="!draft.trim() || busy" @click="submit">
          {{ busy ? 'กำลังส่ง…' : 'โพสต์' }}
        </button>
      </div>
    </div>
  </section>
</template>
