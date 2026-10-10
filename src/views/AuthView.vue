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
  'สมัครด้วยอีเมล ใช้เวลาไม่ถึงนาที',
  'สร้าง แก้ไข และลบโพสต์ของตัวเอง',
  'กด Like และแสดงความคิดเห็นแบบเรียลไทม์',
  'โปรไฟล์สาธารณะพร้อมสถิติของตัวเอง',
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
      toast.ok('ยินดีต้อนรับเข้าสู่ Pulse')
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
    <section class="auth-hero">
      <div>
        <div class="logo">
          <span class="logo-mark">⚡</span>
          <span>
            <span class="logo-text">Pulse</span>
            <span class="logo-sub">// social grid</span>
          </span>
        </div>

        <h1>ส่ง<br /><em>สัญญาณ</em><br />ของคุณ</h1>

        <p class="muted" style="max-width: 44ch">
          เครือข่ายสังคมสไตล์ cyberpunk — แชร์ความคิด กด Like และพูดคุยกับผู้คนบนกริดเดียวกัน
        </p>

        <div class="hero-points">
          <div v-for="(point, index) in points" :key="point" class="hero-point">
            <span>[{{ String(index + 1).padStart(2, '0') }}]</span>
            {{ point }}
          </div>
        </div>
      </div>

      <div class="mono dim">Vue 3 · Express 5 · Drizzle · Turso</div>
    </section>

    <section class="auth-panel">
      <div class="panel panel-hot auth-card">
        <div class="tabs" role="tablist">
          <button
            class="tab"
            :class="{ active: mode === 'login' }"
            type="button"
            role="tab"
            :aria-selected="mode === 'login'"
            @click="switchMode('login')"
          >
            เข้าสู่ระบบ
          </button>
          <button
            class="tab"
            :class="{ active: mode === 'register' }"
            type="button"
            role="tab"
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
              placeholder="เช่น neonrider"
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

          <p v-if="error" class="error-text">{{ error }}</p>

          <button class="btn btn-primary btn-block" type="submit" :disabled="!canSubmit">
            {{ busy ? 'กำลังเชื่อมต่อ…' : mode === 'register' ? 'สร้างบัญชี' : 'เข้าสู่ระบบ' }}
          </button>

          <p class="hint" style="text-align: center">
            {{ mode === 'register' ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?' }}
            <a href="#" class="neon" @click.prevent="switchMode(mode === 'register' ? 'login' : 'register')">
              {{ mode === 'register' ? 'เข้าสู่ระบบ' : 'สมัครฟรี' }}
            </a>
          </p>
        </form>
      </div>
    </section>
  </div>
</template>
