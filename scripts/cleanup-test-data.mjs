#!/usr/bin/env node
/**
 * Removes the throwaway accounts the smoke test / UI tests create
 * (any user whose email ends in @test.dev), then prints row counts.
 *
 *   node scripts/cleanup-test-data.mjs
 */
import { createClient } from '@libsql/client'

import { loadEnv } from '../server/bootstrap.js'

loadEnv()

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  console.error('TURSO_DATABASE_URL is not set (create a .env first)')
  process.exit(1)
}

const client = createClient({ url, ...(authToken ? { authToken } : {}) })
const TABLES = ['users', 'posts', 'likes', 'comments']

async function counts() {
  const out = {}
  for (const table of TABLES) {
    const res = await client.execute(`select count(*) as n from ${table}`)
    out[table] = Number(res.rows[0].n)
  }
  return out
}

const before = await counts()
const doomed = await client.execute(
  "select email from users where email like '%@test.dev' order by email",
)

console.log(`\nDatabase: ${url.startsWith('libsql://') ? 'Turso (remote)' : url}`)
console.log(`Test accounts found: ${doomed.rows.length}`)
for (const row of doomed.rows) console.log(`  - ${row.email}`)

// Deleting the user cascades to their posts, likes and comments.
await client.execute("delete from users where email like '%@test.dev'")

const after = await counts()
console.log('\nRow counts:')
for (const table of TABLES) {
  const delta = before[table] - after[table]
  console.log(`  ${table.padEnd(9)} ${String(after[table]).padStart(4)}${delta ? `  (-${delta})` : ''}`)
}
console.log('\n✅ test data removed\n')
