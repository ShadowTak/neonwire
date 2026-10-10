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
  <section class="panel panel-pad" aria-label="สร้างโพสต์">
    <div class="composer-head">
      <span class="kicker">// broadcast</span>
      <span class="counter" :class="{ warn: draft.length > 430 && draft.length <= MAX, over: draft.length > MAX }">
        {{ draft.length }}/{{ MAX }}
      </span>
    </div>

    <div class="composer-row">
      <UserAvatar :name="auth.user?.username" :accent="auth.user?.accent" />
      <textarea
        v-model="draft"
        class="textarea"
        rows="3"
        :maxlength="MAX"
        placeholder="กำลังคิดอะไรอยู่… พิมพ์สัญญาณของคุณที่นี่"
        @keydown.ctrl.enter="submit"
        @keydown.meta.enter="submit"
      />
    </div>

    <div class="composer-head" style="margin: 12px 0 0">
      <span class="hint">Ctrl + Enter เพื่อโพสต์</span>
      <button class="btn btn-primary btn-sm" type="button" :disabled="!draft.trim() || busy" @click="submit">
        {{ busy ? 'กำลังส่ง…' : 'โพสต์' }}
      </button>
    </div>
  </section>
</template>
