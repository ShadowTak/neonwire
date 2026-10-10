<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login, register } from '../store.js'
import { toast } from '../toast.js'

const route = useRoute()
const router = useRouter()

const mode = ref('login')
const busy = ref(false)
const error = ref('')
const form = reactive({ username: '', email: '', password: '' })

const points = [
  'สร้าง แก้ไข และลบโพสต์ของตัวเองได้ทุกเมื่อ',
  'กดใจและแสดงความคิดเห็นใต้โพสต์ของผู้อื่น',
  'ค้นหาคนและเรื่องที่สนใจจากหน้าสำรวจ',
]

const canSubmit = computed(() => {
  if (busy.value) return false
  if (!form.email.trim() || form.password.length < 8) return false
  if (mode.value === 'register' && form.username.trim().length < 2) return false
  return true
})

function switchMode(next) {
  mode.value = next
  error.value = ''
}

async function submit() {
  if (!canSubmit.value) return
  busy.value = true
  error.value = ''
  try {
    if (mode.value === 'register') {
      await register({ email: form.email.trim(), password: form.password, username: form.username.trim() })
      toast.ok('ยินดีต้อนรับเข้าสู่ Orbit')
    } else {
      await login(form.email.trim(), form.password)
      toast.ok('เข้าสู่ระบบสำเร็จ')
    }
    router.push(String(route.query.next || '/'))
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="auth">
    <section class="auth-intro">
      <RouterLink class="brand" :to="{ name: 'feed' }">
        <span class="brand-mark">◎</span>
        <span>Orbit</span>
      </RouterLink>

      <div>
        <h1 class="auth-headline">เล่าเรื่อง<br />ของคุณ<em>ให้โลกฟัง</em></h1>
        <p class="auth-lead">พื้นที่เล็ก ๆ สำหรับความคิดและบทสนทนาดี ๆ แชร์สิ่งที่คุณกำลังคิด แล้วพูดคุยกับคนที่สนใจเรื่องเดียวกัน</p>
      </div>

      <ul class="auth-list">
        <li v-for="point in points" :key="point">{{ point }}</li>
      </ul>
    </section>

    <section class="auth-panel">
      <div class="card auth-card">
        <h2>{{ mode === 'register' ? 'สร้างบัญชีใหม่' : 'ยินดีต้อนรับกลับ' }}</h2>
        <p class="muted">{{ mode === 'register' ? 'ใช้เวลาไม่ถึงนาที' : 'เข้าสู่ระบบเพื่อดูฟีดของคุณ' }}</p>

        <div class="segmented" role="tablist">
          <button
            type="button"
            role="tab"
            :class="{ on: mode === 'login' }"
            :aria-selected="mode === 'login'"
            @click="switchMode('login')"
          >
            เข้าสู่ระบบ
          </button>
          <button
            type="button"
            role="tab"
            :class="{ on: mode === 'register' }"
            :aria-selected="mode === 'register'"
            @click="switchMode('register')"
          >
            สมัครสมาชิก
          </button>
        </div>

        <form class="form-stack" @submit.prevent="submit">
          <div v-if="mode === 'register'" class="field">
            <label for="username">ชื่อผู้ใช้</label>
            <input
              id="username"
              v-model="form.username"
              class="input"
              type="text"
              autocomplete="username"
              placeholder="เช่น mintwrites"
              maxlength="30"
            />
          </div>

          <div class="field">
            <label for="email">อีเมล</label>
            <input
              id="email"
              v-model="form.email"
              class="input"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
            />
          </div>

          <div class="field">
            <label for="password">รหัสผ่าน</label>
            <input
              id="password"
              v-model="form.password"
              class="input"
              type="password"
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
              placeholder="อย่างน้อย 8 ตัวอักษร"
            />
          </div>

          <p v-if="error" class="error">{{ error }}</p>

          <button class="btn btn-primary btn-block" type="submit" :disabled="!canSubmit">
            {{ busy ? 'กำลังเชื่อมต่อ…' : mode === 'register' ? 'สร้างบัญชี' : 'เข้าสู่ระบบ' }}
          </button>

          <p class="auth-switch">
            {{ mode === 'register' ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?' }}
            <a href="#" @click.prevent="switchMode(mode === 'register' ? 'login' : 'register')">
              {{ mode === 'register' ? 'เข้าสู่ระบบ' : 'สมัครฟรี' }}
            </a>
          </p>
        </form>
      </div>
    </section>
  </div>
</template>
