#!/usr/bin/env node
/**
 * Assert what `npm pack` would publish for `packages/ui`.
 *
 * The locale dictionaries are what DSH reads for the plugin title, so a missing
 * `locale/*.json` (or `icon.svg`) silently degrades the installed plugin. This
 * check runs in CI beside `scripts/check.mjs`.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const uiDir = join(root, 'packages', 'ui')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const result = spawnSync(`${npm} pack --dry-run --json`, {
  cwd: uiDir,
  encoding: 'utf8',
  // npm is a .cmd shim on Windows; one command string avoids the shell-args
  // deprecation warning (no user input is interpolated here).
  shell: true,
})
if (result.error !== undefined) throw result.error
if (result.status !== 0) {
  console.error(result.stderr || result.stdout)
  process.exit(result.status ?? 1)
}

let packs
try {
  packs = JSON.parse(result.stdout)
} catch {
  console.error(`cannot parse npm pack output:\n${result.stdout}`)
  process.exit(1)
}
const files = new Set((packs[0]?.files ?? []).map((file) => file.path))
const required = [
  'index.js',
  'client.js',
  'cordis.patch.yml',
  'icon.svg',
  'README.md',
  'locale/en.json',
  'locale/zh.json',
]
const missing = required.filter((file) => !files.has(file))
if (missing.length > 0) {
  console.error(`npm pack would omit: ${missing.join(', ')}`)
  process.exit(1)
}
if (!files.has('package.json')) {
  console.error('npm pack would omit package.json')
  process.exit(1)
}
console.log(`pack check passed (${files.size} files, locale dictionaries included)`)
