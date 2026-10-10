/**
 * End-to-end smoke test. Start the API first (`npm run dev:api`) then run
 * `npm run test:smoke`. Creates throwaway accounts, so use a test database.
 *
 *   BASE_URL=http://localhost:3000 npm run test:smoke
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const stamp = Date.now()

let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  \u2713 ${label}`)
  } else {
    failed += 1
    console.error(`  \u2717 ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data }
}

async function main() {
  console.log(`\nPulse smoke test → ${BASE}\n`)

  console.log('1. health')
  const health = await api('/api/health')
  check('GET /api/health returns ok', health.status === 200 && health.data?.status === 'ok', JSON.stringify(health.data))

  console.log('\n2. auth')
  const alice = await api('/api/auth/register', {
    method: 'POST',
    body: { email: `alice+${stamp}@test.dev`, password: 'password123', username: `Alice${stamp}` },
  })
  check('register user A', alice.status === 201 && !!alice.data?.token, `status ${alice.status}`)

  const bob = await api('/api/auth/register', {
    method: 'POST',
    body: { email: `bob+${stamp}@test.dev`, password: 'password123', username: `Bob${stamp}` },
  })
  check('register user B', bob.status === 201 && !!bob.data?.token, `status ${bob.status}`)

  const dupe = await api('/api/auth/register', {
    method: 'POST',
    body: { email: `alice+${stamp}@test.dev`, password: 'password123', username: 'dupe' },
  })
  check('duplicate email rejected (409)', dupe.status === 409, `status ${dupe.status}`)

  const weak = await api('/api/auth/register', {
    method: 'POST',
    body: { email: `weak+${stamp}@test.dev`, password: '123', username: 'weak' },
  })
  check('short password rejected (400)', weak.status === 400, `status ${weak.status}`)

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: `alice+${stamp}@test.dev`, password: 'password123' },
  })
  check('login works', login.status === 200 && !!login.data?.token, `status ${login.status}`)

  const badLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: `alice+${stamp}@test.dev`, password: 'wrong-password' },
  })
  check('wrong password rejected (401)', badLogin.status === 401, `status ${badLogin.status}`)

  const tokenA = alice.data.token
  const tokenB = bob.data.token

  const noAuth = await api('/api/posts')
  check('protected route without token → 401', noAuth.status === 401, `status ${noAuth.status}`)

  console.log('\n3. profile')
  const meA = await api('/api/me', { token: tokenA })
  check('GET /api/me returns own profile', meA.status === 200 && meA.data?.user?.id === alice.data.user.id)

  const patchMe = await api('/api/me', {
    method: 'PATCH',
    token: tokenA,
    body: { bio: 'hello from smoke test', accent: 'magenta' },
  })
  check('PATCH /api/me updates bio', patchMe.status === 200 && patchMe.data?.user?.bio === 'hello from smoke test')

  console.log('\n4. posts CRUD')
  const created = await api('/api/posts', { method: 'POST', token: tokenA, body: { content: 'สวัสดี Pulse #smoke' } })
  check('A creates post', created.status === 201 && !!created.data?.post?.id, `status ${created.status}`)
  const postId = created.data?.post?.id

  const emptyPost = await api('/api/posts', { method: 'POST', token: tokenA, body: { content: '   ' } })
  check('empty post rejected (400)', emptyPost.status === 400, `status ${emptyPost.status}`)

  const editByB = await api(`/api/posts/${postId}`, { method: 'PATCH', token: tokenB, body: { content: 'hacked' } })
  check('B cannot edit A post (403)', editByB.status === 403, `status ${editByB.status}`)

  const deleteByB = await api(`/api/posts/${postId}`, { method: 'DELETE', token: tokenB })
  check('B cannot delete A post (403)', deleteByB.status === 403, `status ${deleteByB.status}`)

  const edited = await api(`/api/posts/${postId}`, {
    method: 'PATCH',
    token: tokenA,
    body: { content: 'สวัสดี Pulse (แก้ไขแล้ว)' },
  })
  check('A edits own post', edited.status === 200 && edited.data?.post?.content.includes('แก้ไขแล้ว'))

  console.log('\n5. likes')
  const like = await api(`/api/posts/${postId}/like`, { method: 'POST', token: tokenB })
  check('B likes A post', like.status === 200 && like.data?.post?.likeCount === 1, `count ${like.data?.post?.likeCount}`)

  const likeAgain = await api(`/api/posts/${postId}/like`, { method: 'POST', token: tokenB })
  check('double like is idempotent', likeAgain.status === 200 && likeAgain.data?.post?.likeCount === 1, `count ${likeAgain.data?.post?.likeCount}`)

  const feedForB = await api('/api/posts', { token: tokenB })
  check('feed shows likedByMe for B', feedForB.data?.posts?.find((p) => p.id === postId)?.likedByMe === true)

  const unlike = await api(`/api/posts/${postId}/like`, { method: 'DELETE', token: tokenB })
  check('B unlikes', unlike.status === 200 && unlike.data?.post?.likeCount === 0)
  await api(`/api/posts/${postId}/like`, { method: 'POST', token: tokenB })

  console.log('\n6. comments')
  const comment = await api(`/api/posts/${postId}/comments`, {
    method: 'POST',
    token: tokenB,
    body: { content: 'คอมเมนต์จาก B' },
  })
  check('B comments on A post', comment.status === 201 && comment.data?.post?.commentCount === 1)
  const commentId = comment.data?.post?.comments?.[0]?.id

  const delCommentByA = await api(`/api/comments/${commentId}`, { method: 'DELETE', token: tokenA })
  check('A cannot delete B comment (403)', delCommentByA.status === 403, `status ${delCommentByA.status}`)

  const delCommentByB = await api(`/api/comments/${commentId}`, { method: 'DELETE', token: tokenB })
  check('B deletes own comment', delCommentByB.status === 200 && delCommentByB.data?.post?.commentCount === 0)

  console.log('\n7. scopes and search')
  const mine = await api('/api/posts?scope=mine', { token: tokenA })
  check('scope=mine returns only A posts', mine.data?.posts?.every((p) => p.author.id === alice.data.user.id))

  const search = await api('/api/posts?q=แก้ไข', { token: tokenA })
  check('content search works', search.data?.posts?.some((p) => p.id === postId))

  const otherProfile = await api(`/api/users/${alice.data.user.id}`, { token: tokenB })
  check('B reads A public profile', otherProfile.status === 200 && otherProfile.data?.stats?.posts >= 1)
  check('public profile hides email', otherProfile.data?.user?.email === undefined)

  const stats = await api('/api/stats')
  check('GET /api/stats works', stats.status === 200 && typeof stats.data?.posts === 'number')

  console.log('\n8. delete post')
  const del = await api(`/api/posts/${postId}`, { method: 'DELETE', token: tokenA })
  check('A deletes own post (204)', del.status === 204, `status ${del.status}`)

  const afterDelete = await api('/api/posts', { token: tokenA })
  check('deleted post is gone from feed', !afterDelete.data?.posts?.some((p) => p.id === postId))

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('\nSmoke test crashed:', error.message)
  console.error('Is the API running? (npm run dev:api)')
  process.exit(1)
})
