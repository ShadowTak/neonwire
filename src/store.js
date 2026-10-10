import { reactive, readonly } from 'vue'
import { api, setUnauthorizedHandler } from './api.js'
import { toast } from './toast.js'

const TOKEN_KEY = 'pulse.token'

const state = reactive({
  token: localStorage.getItem(TOKEN_KEY) || '',
  user: null,
  stats: { posts: 0, likes: 0 },
  ready: false,
  busy: false,
})

setUnauthorizedHandler(() => {
  if (state.token) {
    clearSession()
    toast.warn('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
  }
})

function clearSession() {
  state.token = ''
  state.user = null
  state.stats = { posts: 0, likes: 0 }
  localStorage.removeItem(TOKEN_KEY)
}

function setSession(payload) {
  state.token = payload.token
  state.user = payload.user
  localStorage.setItem(TOKEN_KEY, payload.token)
}

/** Restores the session on first load. */
export async function bootstrap() {
  if (!state.token) {
    state.ready = true
    return
  }
  try {
    const data = await api.me(state.token)
    state.user = data.user
    state.stats = data.stats
  } catch {
    clearSession()
  } finally {
    state.ready = true
  }
}

export async function login(email, password) {
  const data = await api.login({ email, password })
  setSession(data)
  await refreshProfile()
}

export async function register(payload) {
  const data = await api.register(payload)
  setSession(data)
  await refreshProfile()
}

export async function refreshProfile() {
  if (!state.token) return
  const data = await api.me(state.token)
  state.user = data.user
  state.stats = data.stats
}

export function logout() {
  clearSession()
}

export const auth = readonly(state)

export function token() {
  return state.token
}
