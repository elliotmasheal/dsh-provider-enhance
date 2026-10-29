#!/usr/bin/env node
/**
 * Install this plugin into a DeepSeek Harness profile.
 *
 * It links the patched adapter under its upstream package name (overriding the
 * bundled one) and installs the UI bundle, then lets the profile's own pnpm
 * link both.
 *
 * Usage:
 *   node scripts/install.mjs [--profile desktop] [--home <DSH_HOME>] [--dry-run] [--no-install]
 *
 * Restart DSH Desktop afterwards.
 */
import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const adapterDir = join(root, 'packages', 'adapter')
const uiDir = join(root, 'packages', 'ui')

const ADAPTER = '@deepseek-ai/dsh-llm-pi-ai'
const UI = 'dsh-provider-enhance'

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
const linkSpec = (dir) => `link:${dir.replaceAll('\\', '/')}`

function stamp() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

/** Locate the node/pnpm bundled with the harness (or on DSH_INSTALL_DIR). */
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
  manifest.dependencies = manifest.dependencies ?? {}

  // The plugin was developed under this pre-release bundle name. Both register
  // the same Models-page slot, so drop the old entry instead of warning.
  const legacyUi = '@local/models-provider-configs'
  const legacyBundles = manifest.dsh?.profile?.bundles
  const removedLegacy =
    manifest.dependencies[legacyUi] !== undefined ||
    (Array.isArray(legacyBundles) && legacyBundles.includes(legacyUi))
  delete manifest.dependencies[legacyUi]

  manifest.dependencies[ADAPTER] = linkSpec(adapterDir)
  manifest.dependencies[UI] = linkSpec(uiDir)
  manifest.dsh = manifest.dsh ?? {}
  manifest.dsh.profile = manifest.dsh.profile ?? {}
  const bundles = (Array.isArray(manifest.dsh.profile.bundles) ? [...manifest.dsh.profile.bundles] : []).filter(
    (entry) => entry !== legacyUi,
  )
  if (!bundles.includes(UI)) bundles.push(UI)
  manifest.dsh.profile.bundles = bundles
  if (removedLegacy) console.log(`removed pre-release bundle "${legacyUi}" from the profile`)

  if (dryRun) {
    console.log(`[dry-run] would write ${manifestPath}`)
    console.log(JSON.stringify({ dependencies: manifest.dependencies, bundles }, null, 2))
    return
  }

  const stampText = stamp()
  await copyFile(manifestPath, `${manifestPath}.bak-${stampText}`)
  if (existsSync(lockPath)) await copyFile(lockPath, `${lockPath}.bak-${stampText}`)
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`wrote ${manifestPath} (backup: ${manifestPath}.bak-${stampText})`)

  if (!skipInstall) {
    const pnpm = findRuntimeBin('pnpm')
    if (pnpm === undefined) {
      throw new Error(
        'cannot find the pnpm bundled with DSH under $DSH_HOME/dsh-runtimes. Re-run with --no-install and run pnpm install in the profile directory yourself.',
      )
    }
    const node = findRuntimeBin('node') ?? process.execPath
    console.log(`pnpm install in ${profileDir}`)
    const result = spawnSync(node, [pnpm, 'install'], { cwd: profileDir, stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`pnpm install failed with exit code ${result.status}`)
  }

  for (const name of [ADAPTER, UI]) {
    const target = join(profileDir, 'node_modules', name)
    if (!existsSync(target)) {
      console.warn(`warning: ${target} is missing; run pnpm install in ${profileDir}`)
    }
  }

  console.log('\nInstalled. Restart DSH Desktop, then open Settings → Models.')
  console.log('Add a third-party provider, then use “+ Add configuration” inside its card.')
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
