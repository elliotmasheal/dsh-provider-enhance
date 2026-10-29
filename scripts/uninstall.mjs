#!/usr/bin/env node
/**
 * Remove this plugin from a DSH profile.
 *
 * The provider profiles you created stay in the profile's cordis.patch.yml.
 * Because the patched adapter understands `accounts` and the bundled one does
 * not, remove those `accounts` blocks (or migrate them back to plain provider
 * entries) before restarting DSH.
 *
 * Usage:
 *   node scripts/uninstall.mjs [--profile desktop] [--home <DSH_HOME>] [--dry-run] [--no-install]
 */
import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'

const ADAPTER = '@deepseek-ai/dsh-llm-pi-ai'
const UI = 'dsh-provider-enhance'

const here = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const index = argv.indexOf(name)
  return index === -1 ? fallback : argv[index + 1]
}
const home = resolve(arg('--home', process.env.DSH_HOME ?? join(homedir(), '.dsh')))
const profileName = arg('--profile', 'desktop')
const dryRun = argv.includes('--dry-run')
const skipInstall = argv.includes('--no-install')
const profileDir = join(home, 'profiles', profileName)
const manifestPath = join(profileDir, 'package.json')
const lockPath = join(profileDir, 'pnpm-lock.yaml')

function stamp() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function findRuntimeBin(name) {
  const relative =
    name === 'pnpm'
      ? ['dependencies', 'pnpm', 'bin', 'pnpm.mjs']
      : ['dependencies', 'node', 'bin', 'node.exe']
  const roots = [join(home, 'dsh-runtimes')]
  if (process.env.DSH_INSTALL_DIR) {
    roots.unshift(join(process.env.DSH_INSTALL_DIR, 'resources', 'runtime', 'primary-runtime'))
  }
  for (const base of roots) {
    if (!existsSync(base)) continue
    const direct = join(base, ...relative)
    if (existsSync(direct)) return direct
    for (const entry of readdirSync(base)) {
      const candidate = join(base, entry, ...relative)
      if (existsSync(candidate)) return candidate
    }
  }
  return undefined
}

async function main() {
  if (!existsSync(manifestPath)) throw new Error(`not a DSH profile: ${manifestPath}`)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

  if (manifest.dependencies !== undefined) {
    delete manifest.dependencies[ADAPTER]
    delete manifest.dependencies[UI]
  }
  const bundles = manifest.dsh?.profile?.bundles
  if (Array.isArray(bundles)) {
    manifest.dsh.profile.bundles = bundles.filter((entry) => entry !== UI)
  }

  if (dryRun) {
    console.log(`[dry-run] would write ${manifestPath}`)
    console.log(JSON.stringify(manifest.dependencies ?? {}, null, 2))
    return
  }

  const stampText = stamp()
  await copyFile(manifestPath, `${manifestPath}.bak-${stampText}`)
  if (existsSync(lockPath)) await copyFile(lockPath, `${lockPath}.bak-${stampText}`)
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  if (!skipInstall) {
    const pnpm = findRuntimeBin('pnpm')
    if (pnpm === undefined) {
      throw new Error('cannot find the bundled pnpm; re-run with --no-install and run pnpm install yourself.')
    }
    const node = findRuntimeBin('node') ?? process.execPath
    const result = spawnSync(node, [pnpm, 'install'], { cwd: profileDir, stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`pnpm install failed with exit code ${result.status}`)
  }

  console.log('\nRemoved. Before restarting DSH, delete any `accounts:` blocks from the')
  console.log('llm-pi-ai provider profiles in the profile cordis.patch.yml — the bundled')
  console.log('adapter does not understand them.')
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
