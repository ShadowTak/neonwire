import { reactive } from 'vue'

let seq = 0

export const toasts = reactive([])

export function pushToast(message, tone = 'info') {
  const id = ++seq
  toasts.push({ id, message, tone })
  setTimeout(() => dismissToast(id), 4000)
  return id
}

export function dismissToast(id) {
  const index = toasts.findIndex((item) => item.id === id)
  if (index >= 0) toasts.splice(index, 1)
}

export const toast = {
  ok: (message) => pushToast(message, 'ok'),
  error: (message) => pushToast(message, 'error'),
  warn: (message) => pushToast(message, 'warn'),
  info: (message) => pushToast(message, 'info'),
}
