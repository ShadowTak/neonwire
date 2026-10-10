#!/usr/bin/env node
/**
 * One-shot automated deploy to Vercel.
 *
 *   node scripts/deploy.mjs              # deploy + verify + cleanup
 *   node scripts/deploy.mjs --no-verify  # deploy only
 *   node scripts/deploy.mjs --project my-app --team team_xxx
 *
 * Requirements:
 *   - VERCEL_TOKEN env var (or --token <value>)
 *   - .env with TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET
 *
 * Why the token + private global config: this machine's Vercel auth file is
 * owned by root, so the CLI cannot read it. Passing --token and pointing
 * --global-config at a temp dir makes the CLI fully independent of that file.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadEnv } from '../server/bootstrap.js'

loadEnv()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const flag = (name) => argv.indexOf(name) !== -1
const value = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

const PROJECT = value('--project') || process.env.VERCEL_PROJECT || 'orbit-social-app'
const verify = !flag('--no-verify')
const REQUIRED = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'JWT_SECRET']
const TARGETS = ['production', 'preview']

let step = 0
const ok = (msg) => console.log(`\n\x1b[36m▸ ${msg}\x1b[0m`)
const good = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`)
const bad = (msg) => console.error(`  \x1b[31m✗\x1b[0m ${msg}`)
const note = (msg) => console.log(`    ${msg}`)

function die(msg) {
  console.error(`\n\x1b[31mDeploy aborted:\x1b[0m ${msg}\n`)
  process.exit(1)
}

/** Reads the team from the machine's existing Vercel config, if readable. */
function detectTeam() {
  const candidates = [
    path.join(os.homedir(), 'Library/Application Support/com.vercel.cli/config.json'),
    path.join(os.homedir(), '.config/com.vercel.cli/config.json'),
  ]
  for (const file of candidates) {
    try {
      const cfg = JSON.parse(readFileSync(file, 'utf8'))
      if (cfg.currentTeam) return cfg.currentTeam
    } catch {
      /* unreadable or absent — fine */
    }
  }
  return ''
}

/* ------------------------------------------------------------ 1. preflight */

ok('1. Checking configuration')

const token = value('--token') || process.env.VERCEL_TOKEN
if (!token) {
  die(
    'missing Vercel token. Create one at https://vercel.com/account/tokens then run:\n' +
      '  VERCEL_TOKEN=xxxx node scripts/deploy.mjs\n' +
      'or: node scripts/deploy.mjs --token xxxx',
  )
}
good(`Vercel token present (${token.slice(0, 6)}…, ${token.length} chars)`)

const missing = REQUIRED.filter((key) => !process.env[key]?.trim())
if (missing.length) die(`.env is missing: ${missing.join(', ')}`)
good('.env has TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET')

if (process.env.JWT_SECRET.trim().length < 32) {
  die(`JWT_SECRET must be at least 32 characters (got ${process.env.JWT_SECRET.trim().length})`)
}
good(`JWT_SECRET length ${process.env.JWT_SECRET.trim().length} (>= 32)`)

const team = value('--team') || process.env.VERCEL_TEAM || detectTeam()
if (team) good(`team scope: ${team}`)
else note('no team detected — using the token default scope')

for (const entry of ['vercel.json', 'api/index.js', 'server/app.js']) {
  if (!existsSync(path.join(root, entry))) die(`${entry} not found — run this from the project root`)
}
good('vercel.json, api/index.js and server/app.js are present')

// The Vercel CLI does NOT read .gitignore — anything not listed in
// .vercelignore gets uploaded, which would leak .env straight to Vercel.
const ignoreFile = path.join(root, '.vercelignore')
if (!existsSync(ignoreFile)) {
  die(
    '.vercelignore is missing. The Vercel CLI does not read .gitignore, so .env\n' +
      '  (with your Turso token and JWT_SECRET) would be uploaded. Refusing to deploy.',
  )
}
const patterns = readFileSync(ignoreFile, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
if (!patterns.some((p) => p === '.env' || p === '.env*' || p === '.env.*')) {
  die('.vercelignore does not exclude .env — your Turso token would be uploaded. Refusing to deploy.')
}
good('.vercelignore excludes .env (secrets stay local)')
if (patterns.includes('dist')) good('.vercelignore excludes dist/ (Vercel builds fresh)')
else note('dist/ is not in .vercelignore — Vercel may serve your local build instead of rebuilding')

// Vercel builds the frontend remotely, so a local dist/ is not required;
// it only matters for running the bundled app locally with `npm start`.
if (existsSync(path.join(root, 'dist'))) good('local dist/ present')
else note('dist/ not built locally — Vercel will build it (run `npm run build` only for local `npm start`)')

/* ------------------------------------------------------------ 2. CLI setup */

ok('2. Preparing a private Vercel CLI config')

const globalConfig = mkdtempSync(path.join(os.tmpdir(), 'pulse-vercel-'))
note(`global config dir: ${globalConfig} (bypasses the root-owned auth.json)`)

const cli = (args, { capture = false } = {}) => {
  const full = ['--yes', 'vercel@latest', '--token', token, '--global-config', globalConfig]
  if (team) full.push('--scope', team)
  full.push(...args)

  const result = spawnSync('npx', full, {
    cwd: root,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
  })
  return {
    code: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  }
}

/* --------------------------------------------------- 3. create + link project */

ok(`3. Creating / linking Vercel project "${PROJECT}"`)

const created = cli(['project', 'create', PROJECT], { capture: true })
if (created.code === 0) {
  good(`project created: ${PROJECT}`)
} else if (/already exists|conflict/i.test(created.stdout + created.stderr)) {
  good(`project already exists: ${PROJECT}`)
} else {
  note('project create did not succeed cleanly — continuing, link will confirm')
  note((created.stderr || created.stdout).trim().split('\n').slice(-3).join('\n    '))
}

const linked = cli(['link', '--project', PROJECT, '--yes'], { capture: true })
if (linked.code !== 0) {
  bad('vercel link failed')
  console.error((linked.stderr || linked.stdout).trim())
  die('could not link the project — check that the token has access to this scope')
}
good(`linked → .vercel/project.json`)

/* -------------------------------------------------------- 4. environment vars */

ok('4. Setting environment variables (production + preview)')

for (const key of REQUIRED) {
  for (const target of TARGETS) {
    const res = cli(
      ['env', 'add', key, target, '--value', process.env[key].trim(), '--force', '--yes'],
      { capture: true },
    )
    if (res.code === 0) {
      good(`${key} → ${target}`)
    } else {
      // The CLI returns non-zero for "already exists" in some versions even with
      // --force; only treat it as fatal when the message is not about existing.
      const msg = `${res.stdout}${res.stderr}`
      if (/already exists|duplicate/i.test(msg)) {
        good(`${key} → ${target} (already set)`)
      } else {
        bad(`${key} → ${target} failed`)
        console.error(msg.trim().split('\n').slice(-4).join('\n'))
        die(`could not set ${key} for ${target}`)
      }
    }
  }
}

/* ----------------------------------------------------------------- 5. deploy */

ok('5. Deploying to production (this builds on Vercel, ~1-3 min)')

const deployed = cli(['deploy', '--prod', '--json'], { capture: true })
const raw = `${deployed.stdout}\n${deployed.stderr}`

let deployUrl = ''
const matches = [...raw.matchAll(/"url"\s*:\s*"([^"]+)"/g)]
if (matches.length) deployUrl = matches[matches.length - 1][1]

if (deployed.code !== 0 || !deployUrl) {
  bad('deploy failed')
  console.error(raw.trim().split('\n').slice(-25).join('\n'))
  die('deployment did not finish successfully')
}

const base = deployUrl.startsWith('http') ? deployUrl : `https://${deployUrl}`
good(`deployed: ${base}`)

if (deployed.stdout.trim() && !deployed.stdout.trim().startsWith('{')) {
  note(deployed.stdout.trim().split('\n').slice(-6).join('\n    '))
}

/* ---------------------------------------------------------------- 6. verify */

if (!verify) {
  ok('6. Verification skipped (--no-verify)')
} else {
  ok('6. Verifying the live deployment')

  const get = async (url) => {
    const res = await fetch(url, { redirect: 'follow' })
    return { status: res.status, body: await res.text() }
  }

  const wait = async (label, fn, attempts = 12) => {
    for (let i = 1; i <= attempts; i++) {
      try {
        const result = await fn()
        if (result) {
          good(label)
          return result
        }
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 4000))
    }
    bad(`${label} — timed out after ${attempts} attempts`)
    return null
  }

  const health = await wait('/api/health returns ok + database connected', async () => {
    const { status, body } = await get(`${base}/api/health`)
    if (status !== 200) return null
    const data = JSON.parse(body)
    return data.status === 'ok' && data.database === 'connected' ? data : null
  })
  if (!health) die('the deployed API cannot reach Turso — check the env vars in Vercel')

  await wait('GET / serves the SPA', async () => {
    const { status, body } = await get(`${base}/`)
    return status === 200 && body.includes('id="app"') ? true : null
  })

  await wait('SPA deep link /explore works (Vercel routing)', async () => {
    const { status } = await get(`${base}/explore`)
    return status === 200 ? true : null
  })

  await wait('static assets are not swallowed by the SPA rewrite', async () => {
    const { body } = await get(`${base}/`)
    const match = body.match(/\/assets\/[^"]+\.js/)
    if (!match) return null
    const asset = await get(`${base}${match[0]}`)
    return asset.status === 200 && asset.body.includes('import') ? true : null
  })

  await wait('unknown API route returns 404', async () => {
    const { status } = await get(`${base}/api/definitely-not-a-route`)
    return status === 404 ? true : null
  })

  ok('7. Running the 29-point API suite against the live URL')
  const smoke = spawnSync(process.execPath, ['scripts/smoke.js'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, BASE_URL: base },
  })
  const smokeOut = `${smoke.stdout || ''}${smoke.stderr || ''}`
  const summary = smokeOut.trim().split('\n').slice(-2).join(' ').trim()
  if (smoke.status === 0) good(summary || 'smoke test passed')
  else {
    console.error(smokeOut.trim().split('\n').slice(-20).join('\n'))
    die('smoke test failed against the live deployment')
  }

  ok('8. Removing test data created during verification')
  const clean = spawnSync(process.execPath, ['scripts/cleanup-test-data.mjs'], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  })
  process.stdout.write(`${clean.stdout || ''}${clean.stderr || ''}`)
  if (clean.status !== 0) note('cleanup reported a problem (see above) — test rows may remain')
}

/* ------------------------------------------------------------------ 7. done */

console.log(`\n\x1b[32m═══════════════════════════════════════════════════════\x1b[0m`)
console.log(`\x1b[1m  Public URL:\x1b[0m ${base}`)
console.log(`  Dashboard:  https://vercel.com/dashboard`)
console.log(`  Repo:       https://github.com/ShadowTak/pulse-social`)
console.log(`\n  ${verify ? 'Verified' : 'Not verified'}: health, SPA routing, static assets, 404s${verify ? ', 29 API tests' : ''}`)
console.log(`\n  \x1b[33mNow revoke the deploy token:\x1b[0m https://vercel.com/account/tokens`)
console.log(`\x1b[32m═══════════════════════════════════════════════════════\x1b[0m\n`)
