#!/usr/bin/env node
/**
 * Remove this plugin from a DSH profile.
 *
 * The provider profiles you created stay in the profile's cordis.patch.yml.
 * Because the bundled adapter does not understand `accounts`, leaving those
 * blocks behind breaks provider loading after a restart, so this script removes
 * them as well (after backing the file up). Pass --keep-accounts to keep them,
 * for example while switching back to the patched adapter.
 *
 * Usage:
 *   node scripts/uninstall.mjs [--profile desktop] [--home <DSH_HOME>]
 *                              [--dry-run] [--no-install] [--keep-accounts]
 */
import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { stripAccounts } from './lib/accounts.mjs'

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
const keepAccounts = argv.includes('--keep-accounts')
const profileDir = join(home, 'profiles', profileName)
const manifestPath = join(profileDir, 'package.json')
const lockPath = join(profileDir, 'pnpm-lock.yaml')
const patchPath = join(profileDir, 'cordis.patch.yml')

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
  const patch = existsSync(patchPath) ? await readFile(patchPath, 'utf8') : undefined
  const stripped = patch === undefined || keepAccounts ? undefined : stripAccounts(patch)

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
    if (stripped !== undefined) {
      console.log(`[dry-run] would remove ${stripped.removed} accounts block(s) from ${patchPath}`)
    }
    return
  }

  const stampText = stamp()
  await copyFile(manifestPath, `${manifestPath}.bak-${stampText}`)
  if (existsSync(lockPath)) await copyFile(lockPath, `${lockPath}.bak-${stampText}`)
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  if (stripped !== undefined && stripped.removed > 0) {
    await copyFile(patchPath, `${patchPath}.bak-${stampText}`)
    await writeFile(patchPath, stripped.text)
    console.log(`removed ${stripped.removed} accounts block(s) from ${patchPath}`)
    console.log(`(backup: ${patchPath}.bak-${stampText})`)
  }

  if (!skipInstall) {
    const pnpm = findRuntimeBin('pnpm')
    if (pnpm === undefined) {
      throw new Error('cannot find the bundled pnpm; re-run with --no-install and run pnpm install yourself.')
    }
    const node = findRuntimeBin('node') ?? process.execPath
    const result = spawnSync(node, [pnpm, 'install'], { cwd: profileDir, stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`pnpm install failed with exit code ${result.status}`)
  }

  if (keepAccounts) {
    console.log('\nRemoved. accounts blocks were kept as requested; the bundled adapter')
    console.log('rejects them, so delete them before restarting DSH unless you are')
    console.log('re-installing the patched adapter.')
  } else if (stripped === undefined) {
    console.log('\nRemoved. No cordis.patch.yml was found, so nothing else was changed.')
  } else {
    console.log('\nRemoved. Restart DSH Desktop.')
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
