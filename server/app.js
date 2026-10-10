import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import express from 'express'
import bcrypt from 'bcryptjs'
import { and, desc, eq, inArray, like, or, sql } from 'drizzle-orm'

import { db, ensureSchema, pingDatabase } from './db.js'
import { comments, likes, posts, users } from './schema.js'
import { requireAuth, signToken } from './auth.js'

export const ACCENTS = ['cyan', 'magenta', 'lime', 'violet', 'amber']
const MAX_POST_LENGTH = 500
const MAX_COMMENT_LENGTH = 300

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '32kb' }))

/* ---------------------------------------------------------------- helpers */

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const fail = (res, status, message) => res.status(status).json({ message })

const isEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const clean = (value) => (typeof value === 'string' ? value.trim() : '')

async function profileStats(userId) {
  const [postRow] = await db
    .select({ count: sql`count(*)`.mapWith(Number) })
    .from(posts)
    .where(eq(posts.userId, userId))

  const [likeRow] = await db
    .select({ count: sql`count(*)`.mapWith(Number) })
    .from(likes)
    .innerJoin(posts, eq(likes.postId, posts.id))
    .where(eq(posts.userId, userId))

  return { posts: postRow?.count ?? 0, likes: likeRow?.count ?? 0 }
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    bio: row.bio,
    accent: row.accent,
    createdAt: row.createdAt,
  }
}

async function fetchProfiles(userIds) {
  if (!userIds.length) return new Map()
  const rows = await db
    .select({ id: users.id, username: users.username, accent: users.accent })
    .from(users)
    .where(inArray(users.id, userIds))
  return new Map(rows.map((row) => [row.id, row]))
}

/**
 * Loads posts with author, like count, comment count, viewer liked state and
 * the full comment tree. One query per table keeps this readable on libSQL.
 */
async function loadFeed({ viewerId = null, scope = 'all', q = '', authorId = null, limit = 50 } = {}) {
  const filters = []
  if (scope === 'mine' && viewerId) filters.push(eq(posts.userId, viewerId))
  if (authorId) filters.push(eq(posts.userId, Number(authorId)))
  if (q) filters.push(like(posts.content, `%${q}%`))

  const rows = await db
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      authorId: users.id,
      authorName: users.username,
      authorAccent: users.accent,
      likeCount: sql`count(distinct ${likes.id})`.mapWith(Number),
      commentCount: sql`count(distinct ${comments.id})`.mapWith(Number),
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .leftJoin(likes, eq(likes.postId, posts.id))
    .leftJoin(comments, eq(comments.postId, posts.id))
    .where(filters.length ? and(...filters) : undefined)
    .groupBy(posts.id)
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(Math.min(Number(limit) || 50, 100))

  const ids = rows.map((row) => row.id)
  if (!ids.length) return []

  const commentRows = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      content: comments.content,
      createdAt: comments.createdAt,
      authorId: users.id,
      authorName: users.username,
      authorAccent: users.accent,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(inArray(comments.postId, ids))
    .orderBy(comments.createdAt, comments.id)

  const likedIds = new Set()
  if (viewerId) {
    const liked = await db
      .select({ postId: likes.postId })
      .from(likes)
      .where(and(eq(likes.userId, viewerId), inArray(likes.postId, ids)))
    for (const row of liked) likedIds.add(row.postId)
  }

  const byPost = new Map()
  for (const row of commentRows) {
    if (!byPost.has(row.postId)) byPost.set(row.postId, [])
    byPost.get(row.postId).push({
      id: row.id,
      postId: row.postId,
      content: row.content,
      createdAt: row.createdAt,
      author: { id: row.authorId, username: row.authorName, accent: row.authorAccent },
    })
  }

  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    likedByMe: likedIds.has(row.id),
    author: { id: row.authorId, username: row.authorName, accent: row.authorAccent },
    comments: byPost.get(row.id) || [],
  }))
}

async function loadPost(postId, viewerId = null) {
  const [post] = await loadFeed({ viewerId, limit: 100 }).then((all) => all.filter((p) => p.id === postId))
  return post || null
}

/* ------------------------------------------------------------------ routes */

app.get(
  '/api/health',
  wrap(async (_req, res) => {
    await pingDatabase()
    res.json({ status: 'ok', database: 'connected' })
  }),
)

app.get(
  '/api/stats',
  wrap(async (_req, res) => {
    await ensureSchema()
    const [row] = await db
      .select({
        users: sql`(select count(*) from users)`.mapWith(Number),
        posts: sql`(select count(*) from posts)`.mapWith(Number),
        likes: sql`(select count(*) from likes)`.mapWith(Number),
        comments: sql`(select count(*) from comments)`.mapWith(Number),
      })
      .from(sql`(select 1)`)
    res.json(row)
  }),
)

/* auth --------------------------------------------------------------------- */

app.post(
  '/api/auth/register',
  wrap(async (req, res) => {
    await ensureSchema()
    const email = clean(req.body?.email).toLowerCase()
    const username = clean(req.body?.username)
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    if (!isEmail(email)) return fail(res, 400, 'อีเมลไม่ถูกต้อง')
    if (username.length < 2 || username.length > 30) return fail(res, 400, 'ชื่อผู้ใช้ต้องมี 2-30 ตัวอักษร')
    if (password.length < 8) return fail(res, 400, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
    if (existing) return fail(res, 409, 'อีเมลนี้ถูกใช้งานแล้ว')

    const accent = ACCENTS.includes(req.body?.accent) ? req.body.accent : ACCENTS[Math.floor(Math.random() * ACCENTS.length)]
    const passwordHash = await bcrypt.hash(password, 10)
    const [created] = await db
      .insert(users)
      .values({ email, username, passwordHash, accent })
      .returning()

    res.status(201).json({ token: signToken(created), user: publicUser(created) })
  }),
)

app.post(
  '/api/auth/login',
  wrap(async (req, res) => {
    await ensureSchema()
    const email = clean(req.body?.email).toLowerCase()
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    const [user] = await db.select().from(users).where(eq(users.email, email))
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return fail(res, 401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    }

    res.json({ token: signToken(user), user: publicUser(user) })
  }),
)

/* profile ------------------------------------------------------------------ */

app.get(
  '/api/me',
  requireAuth,
  wrap(async (req, res) => {
    await ensureSchema()
    const [user] = await db.select().from(users).where(eq(users.id, req.userId))
    if (!user) return fail(res, 404, 'ไม่พบผู้ใช้')
    res.json({ user: publicUser(user), stats: await profileStats(user.id) })
  }),
)

app.patch(
  '/api/me',
  requireAuth,
  wrap(async (req, res) => {
    await ensureSchema()
    const patch = {}

    if (req.body?.username !== undefined) {
      const username = clean(req.body.username)
      if (username.length < 2 || username.length > 30) return fail(res, 400, 'ชื่อผู้ใช้ต้องมี 2-30 ตัวอักษร')
      patch.username = username
    }
    if (req.body?.bio !== undefined) {
      const bio = clean(req.body.bio)
      if (bio.length > 200) return fail(res, 400, 'bio ต้องไม่เกิน 200 ตัวอักษร')
      patch.bio = bio
    }
    if (req.body?.accent !== undefined) {
      if (!ACCENTS.includes(req.body.accent)) return fail(res, 400, 'สีโปรไฟล์ไม่ถูกต้อง')
      patch.accent = req.body.accent
    }
    if (!Object.keys(patch).length) return fail(res, 400, 'ไม่มีข้อมูลที่ต้องอัปเดต')

    const [updated] = await db.update(users).set(patch).where(eq(users.id, req.userId)).returning()
    res.json({ user: publicUser(updated), stats: await profileStats(updated.id) })
  }),
)

app.get(
  '/api/users/:id',
  requireAuth,
  wrap(async (req, res) => {
    await ensureSchema()
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return fail(res, 400, 'รหัสผู้ใช้ไม่ถูกต้อง')

    const [user] = await db.select().from(users).where(eq(users.id, id))
    if (!user) return fail(res, 404, 'ไม่พบผู้ใช้')

    res.json({
      user: { id: user.id, username: user.username, bio: user.bio, accent: user.accent, createdAt: user.createdAt },
      stats: await profileStats(user.id),
      posts: await loadFeed({ viewerId: req.userId, authorId: user.id }),
      isMe: user.id === req.userId,
    })
  }),
)

/* posts -------------------------------------------------------------------- */

app.get(
  '/api/posts',
  requireAuth,
  wrap(async (req, res) => {
    await ensureSchema()
    const scope = req.query.scope === 'mine' ? 'mine' : 'all'
    const q = clean(req.query.q).slice(0, 80)
    res.json({ posts: await loadFeed({ viewerId: req.userId, scope, q }) })
  }),
)

app.post(
  '/api/posts',
  requireAuth,
  wrap(async (req, res) => {
    await ensureSchema()
    const content = clean(req.body?.content)
    if (!content) return fail(res, 400, 'กรุณาพิมพ์เนื้อหาโพสต์')
    if (content.length > MAX_POST_LENGTH) return fail(res, 400, `โพสต์ต้องไม่เกิน ${MAX_POST_LENGTH} ตัวอักษร`)

    const [created] = await db.insert(posts).values({ userId: req.userId, content }).returning()
    const post = await loadPost(created.id, req.userId)
    res.status(201).json({ post })
  }),
)

app.patch(
  '/api/posts/:id',
  requireAuth,
  wrap(async (req, res) => {
    await ensureSchema()
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return fail(res, 400, 'รหัสโพสต์ไม่ถูกต้อง')

    const [post] = await db.select().from(posts).where(eq(posts.id, id))
    if (!post) return fail(res, 404, 'ไม่พบโพสต์')
    if (post.userId !== req.userId) return fail(res, 403, 'แก้ไขได้เฉพาะโพสต์ของตัวเอง')

    const content = clean(req.body?.content)
    if (!content) return fail(res, 400, 'กรุณาพิมพ์เนื้อหาโพสต์')
    if (content.length > MAX_POST_LENGTH) return fail(res, 400, `โพสต์ต้องไม่เกิน ${MAX_POST_LENGTH} ตัวอักษร`)

    await db.update(posts).set({ content, updatedAt: new Date() }).where(eq(posts.id, id))
    res.json({ post: await loadPost(id, req.userId) })
  }),
)

app.delete(
  '/api/posts/:id',
  requireAuth,
  wrap(async (req, res) => {
    await ensureSchema()
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return fail(res, 400, 'รหัสโพสต์ไม่ถูกต้อง')

    const [post] = await db.select().from(posts).where(eq(posts.id, id))
    if (!post) return fail(res, 404, 'ไม่พบโพสต์')
    if (post.userId !== req.userId) return fail(res, 403, 'ลบได้เฉพาะโพสต์ของตัวเอง')

    await db.delete(posts).where(eq(posts.id, id))
    res.status(204).end()
  }),
)

/* likes -------------------------------------------------------------------- */

async function assertPost(res, id) {
  if (!Number.isInteger(id)) {
    fail(res, 400, 'รหัสโพสต์ไม่ถูกต้อง')
    return null
  }
  const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, id))
  if (!post) {
    fail(res, 404, 'ไม่พบโพสต์')
    return null
  }
  return post
}

app.post(
  '/api/posts/:id/like',
  requireAuth,
  wrap(async (req, res) => {
    await ensureSchema()
    const id = Number(req.params.id)
    if (!(await assertPost(res, id))) return

    await db.insert(likes).values({ postId: id, userId: req.userId }).onConflictDoNothing()
    res.json({ post: await loadPost(id, req.userId) })
  }),
)

app.delete(
  '/api/posts/:id/like',
  requireAuth,
  wrap(async (req, res) => {
    await ensureSchema()
    const id = Number(req.params.id)
    if (!(await assertPost(res, id))) return

    await db.delete(likes).where(and(eq(likes.postId, id), eq(likes.userId, req.userId)))
    res.json({ post: await loadPost(id, req.userId) })
  }),
)

/* comments ----------------------------------------------------------------- */

app.post(
  '/api/posts/:id/comments',
  requireAuth,
  wrap(async (req, res) => {
    await ensureSchema()
    const id = Number(req.params.id)
    if (!(await assertPost(res, id))) return

    const content = clean(req.body?.content)
    if (!content) return fail(res, 400, 'กรุณาพิมพ์ความคิดเห็น')
    if (content.length > MAX_COMMENT_LENGTH) return fail(res, 400, `ความคิดเห็นต้องไม่เกิน ${MAX_COMMENT_LENGTH} ตัวอักษร`)

    await db.insert(comments).values({ postId: id, userId: req.userId, content })
    res.status(201).json({ post: await loadPost(id, req.userId) })
  }),
)

app.delete(
  '/api/comments/:id',
  requireAuth,
  wrap(async (req, res) => {
    await ensureSchema()
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return fail(res, 400, 'รหัสความคิดเห็นไม่ถูกต้อง')

    const [comment] = await db.select().from(comments).where(eq(comments.id, id))
    if (!comment) return fail(res, 404, 'ไม่พบความคิดเห็น')
    if (comment.userId !== req.userId) return fail(res, 403, 'ลบได้เฉพาะความคิดเห็นของตัวเอง')

    await db.delete(comments).where(eq(comments.id, id))
    res.json({ post: await loadPost(comment.postId, req.userId) })
  }),
)

/* search users ------------------------------------------------------------- */

app.get(
  '/api/users',
  requireAuth,
  wrap(async (req, res) => {
    await ensureSchema()
    const q = clean(req.query.q)
    if (!q) return res.json({ users: [] })

    const rows = await db
      .select({ id: users.id, username: users.username, accent: users.accent, bio: users.bio })
      .from(users)
      .where(or(like(users.username, `%${q}%`), like(users.bio, `%${q}%`)))
      .limit(10)

    res.json({ users: rows })
  }),
)

/* ------------------------------------- static SPA hosting for `npm start` */
// On Vercel the CDN serves the built assets, so this only runs locally.
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
if (!process.env.VERCEL && fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')))
}

/* --------------------------------------------------------------- fallbacks */

app.use('/api', (_req, res) => fail(res, 404, 'ไม่พบเส้นทาง API นี้'))

// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.parse.failed') return fail(res, 400, 'รูปแบบ JSON ไม่ถูกต้อง')
  console.error('[api-error]', error)
  const status = Number(error?.status) || 500
  fail(res, status, status === 500 ? 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' : error.message)
})

export default app
