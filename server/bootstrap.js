import fs from 'node:fs'
import path from 'node:path'

let loaded = false

/**
 * Minimal .env loader. On Vercel the variables are injected by the platform,
 * so we only read a local file when it exists and never override real env vars.
 */
export function loadEnv(cwd = process.cwd()) {
  if (loaded) return
  loaded = true

  const file = path.join(cwd, '.env')
  if (!fs.existsSync(file)) return

  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq < 1) continue

    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) process.env[key] = value
  }
}
