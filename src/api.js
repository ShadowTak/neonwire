let handleUnauthorized = () => {}
export function setUnauthorizedHandler(fn) {
  handleUnauthorized = fn
}

// Empty for same-origin (dev proxy / single deployment); set VITE_API_BASE to
// the backend origin when the API is deployed separately.
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

/**
 * Thin fetch wrapper. Talks to `/api/*` on the API origin.
 */
export async function request(path, { method = 'GET', body, token } = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบว่า API ทำงานอยู่')
  }

  if (res.status === 401) handleUnauthorized()
  if (res.status === 204) return null

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!res.ok) {
    const error = new Error(data?.message || `คำขอล้มเหลว (${res.status})`)
    error.status = res.status
    throw error
  }

  return data
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: (token) => request('/me', { token }),
  updateMe: (token, payload) => request('/me', { method: 'PATCH', body: payload, token }),
  user: (token, id) => request(`/users/${id}`, { token }),
  searchUsers: (token, q) => request(`/users?q=${encodeURIComponent(q)}`, { token }),
  posts: (token, { scope = 'all', q = '' } = {}) =>
    request(`/posts?scope=${scope}&q=${encodeURIComponent(q)}`, { token }),
  createPost: (token, content) => request('/posts', { method: 'POST', body: { content }, token }),
  updatePost: (token, id, content) => request(`/posts/${id}`, { method: 'PATCH', body: { content }, token }),
  deletePost: (token, id) => request(`/posts/${id}`, { method: 'DELETE', token }),
  like: (token, id) => request(`/posts/${id}/like`, { method: 'POST', token }),
  unlike: (token, id) => request(`/posts/${id}/like`, { method: 'DELETE', token }),
  comment: (token, id, content) => request(`/posts/${id}/comments`, { method: 'POST', body: { content }, token }),
  deleteComment: (token, id) => request(`/comments/${id}`, { method: 'DELETE', token }),
  stats: () => request('/stats'),
}
