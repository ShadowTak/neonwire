import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const targets = ['server', 'api', 'scripts']

function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) collect(full, out)
    else if (/\.m?js$/.test(entry)) out.push(full)
  }
  return out
}

let failed = 0
for (const dir of targets) {
  for (const file of collect(path.join(root, dir))) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
      console.log(`  ✓ ${path.relative(root, file)}`)
    } catch (error) {
      failed += 1
      console.error(`  ✗ ${path.relative(root, file)}`)
      console.error(String(error.stderr || error.message))
    }
  }
}

const total = targets.reduce((sum, dir) => sum + collect(path.join(root, dir)).length, 0)
console.log(
  failed === 0
    ? `\n✅ syntax check passed (${total} files)\n`
    : `\n❌ ${failed} of ${total} file(s) failed\n`,
)
process.exit(failed === 0 ? 0 : 1)
