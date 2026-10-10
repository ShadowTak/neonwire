import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { sql } from 'drizzle-orm'
import * as schema from './schema.js'
import { loadEnv } from './bootstrap.js'

loadEnv()

const url = process.env.TURSO_DATABASE_URL || 'file:./local.db'
const authToken = process.env.TURSO_AUTH_TOKEN

if (url.startsWith('libsql://') && !authToken) {
  throw new Error('TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL points to a remote Turso database')
}

export const isRemote = url.startsWith('libsql://') || url.startsWith('https://')
export const databaseUrl = url

export const client = createClient({
  url,
  ...(authToken ? { authToken } : {}),
  ...(isRemote ? { intMode: 'number' } : {}),
})

export const db = drizzle(client, { schema })

const DDL = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    username TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    accent TEXT NOT NULL DEFAULT 'cyan',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS likes_post_user_unique ON likes (post_id, user_id)',
  'CREATE INDEX IF NOT EXISTS posts_user_idx ON posts (user_id)',
  'CREATE INDEX IF NOT EXISTS posts_created_idx ON posts (created_at)',
  'CREATE INDEX IF NOT EXISTS comments_post_idx ON comments (post_id)',
]

let ready = null

async function initialize() {
  for (const statement of DDL) {
    await client.execute(statement)
  }
  await client.execute('PRAGMA foreign_keys = ON')
}

/** Creates the tables on first use. Safe to call on every request. */
export function ensureSchema() {
  if (!ready) {
    ready = initialize().catch((error) => {
      ready = null
      throw error
    })
  }
  return ready
}

export async function pingDatabase() {
  await ensureSchema()
  await db.run(sql`SELECT 1`)
  return true
}

export { schema }
