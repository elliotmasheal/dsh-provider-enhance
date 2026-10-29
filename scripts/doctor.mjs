#!/usr/bin/env node
/**
 * Diagnose an installed ProviderEnhance profile without starting DSH.
 *
 * It reads the profile manifest, the materialized node_modules links, the
 * profile patch file and (when the install directory is known) the installed
 * DSH version, then reports what is wrong and which document fixes it.
 *
 * Usage:
 *   node scripts/doctor.mjs [--profile desktop] [--home <DSH_HOME>]
 *                           [--install "<DeepSeek Harness install>"]
 *
 * Exit code 1 when a check fails, 0 otherwise (warnings do not fail).
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { accountNames, duplicateAccountNames } from './lib/accounts.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ADAPTER = '@deepseek-ai/dsh-llm-pi-ai'
const UI = 'dsh-provider-enhance'
const MARKERS = [
  'function inheritedCatalog(',
  'function overlayAccount(',
  'function catalogServesModels(',
  "A configuration's own protocol and endpoint win over the catalog",
  'const OPENCODE_SESSION_HEADER = "x-opencode-session";',
  'provider.includes("#") || profile.catalog !== void 0 && profile.configName === void 0',
  'requestHeaders(profile.headers, profile.catalog ?? profile.provider)',
]

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const index = argv.indexOf(name)
  return index === -1 ? fallback : argv[index + 1]
}
const home = resolve(arg('--home', process.env.DSH_HOME ?? join(homedir(), '.dsh')))
const profileName = arg('--profile', 'desktop')
const profileDir = join(home, 'profiles', profileName)
const manifestPath = join(profileDir, 'package.json')
const patchPath = join(profileDir, 'cordis.patch.yml')
const results = []

function report(level, message, fix) {
  results.push({ level, message, fix })
}

function check(condition, level, message, fix) {
  if (condition) report('ok', message)
  else report(level, message, fix)
  return condition
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function linkedPath(spec) {
  if (typeof spec !== 'string' || !spec.startsWith('link:')) return undefined
  return resolve(profileDir, spec.slice('link:'.length))
}

function real(path) {
  try {
    return realpathSync(path)
  } catch {
    return undefined
  }
}

function installedVersion() {
  const install = arg('--install', process.env.DSH_INSTALL_DIR)
  if (install === undefined) return undefined
  for (const relative of [['resources', 'app', 'dsh', 'package.json'], ['resources', 'app.asar', 'dsh', 'package.json']]) {
    const file = join(install, ...relative)
    if (existsSync(file)) return readJson(file).version
  }
  return undefined
}

/** Pull the lowest version out of a simple engine range such as `^0.2.1-rc.3`. */
function targetVersion(range) {
  return typeof range === 'string' ? range.replace(/^[\^~>=<\s]+/, '').trim() : undefined
}

console.log(`ProviderEnhance doctor\nhome:    ${home}\nprofile: ${profileName}\n`)

if (!check(existsSync(manifestPath), 'fail', `profile manifest exists: ${manifestPath}`, 'check --profile / --home; DSH Desktop creates it on first start')) {
  print()
  process.exit(1)
}

const manifest = readJson(manifestPath)
const dependencies = manifest.dependencies ?? {}
const bundles = manifest.dsh?.profile?.bundles
const adapterRepoDir = join(root, 'packages', 'adapter')
const uiRepoDir = join(root, 'packages', 'ui')
const adapterSpec = dependencies[ADAPTER]
const uiSpec = dependencies[UI]

check(adapterSpec !== undefined, 'fail', 'patched adapter is a profile dependency', 'run `node scripts/install.mjs`')
check(
  adapterSpec !== undefined && real(linkedPath(adapterSpec)) === real(adapterRepoDir),
  'warn',
  `adapter ${ADAPTER} points at this repository (${adapterSpec ?? 'missing'})`,
  're-run `node scripts/install.mjs` so the profile links packages/adapter again',
)
check(uiSpec !== undefined, 'fail', `UI bundle ${UI} is a profile dependency`, 'run `node scripts/install.mjs`')
check(
  uiSpec !== undefined && real(linkedPath(uiSpec)) === real(uiRepoDir),
  'warn',
  `UI bundle ${UI} points at this repository (${uiSpec ?? 'missing'})`,
  're-run `node scripts/install.mjs` so the profile links packages/ui again',
)
check(Array.isArray(bundles) && bundles.includes(UI), 'fail', 'UI bundle is selected in dsh.profile.bundles', 'run `node scripts/install.mjs`')

const materializedAdapter = join(profileDir, 'node_modules', ADAPTER)
const materializedUi = join(profileDir, 'node_modules', UI)
check(existsSync(materializedAdapter), 'fail', `adapter is materialized in node_modules (${materializedAdapter})`, 'run `pnpm install` in the profile, or re-run the installer')
check(existsSync(materializedUi), 'fail', `UI bundle is materialized in node_modules (${materializedUi})`, 'run `pnpm install` in the profile, or re-run the installer')

const adapterFile = existsSync(join(materializedAdapter, 'lib', 'index.js'))
  ? join(materializedAdapter, 'lib', 'index.js')
  : join(adapterRepoDir, 'lib', 'index.js')
if (existsSync(adapterFile)) {
  const code = readFileSync(adapterFile, 'utf8')
  const missing = MARKERS.filter((marker) => !code.includes(marker))
  check(
    missing.length === 0,
    'fail',
    'adapter carries every ProviderEnhance patch',
    `the adapter at ${adapterFile} is not the patched build; re-link packages/adapter or follow docs/upgrading.md (missing: ${missing.join(' | ')})`,
  )
}

if (existsSync(materializedUi)) {
  try {
    const require = createRequire(manifestPath)
    const titles = {}
    for (const language of ['en', 'zh']) {
      const file = require.resolve(`${UI}/locale/${language}.json`)
      titles[language] = JSON.parse(readFileSync(file, 'utf8')).meta?.title
    }
    check(titles.en === 'ProviderEnhance', 'warn', `English plugin title is "ProviderEnhance" (got ${JSON.stringify(titles.en)})`, 'restore packages/ui/locale/en.json')
    check(titles.zh === '供应商增强', 'warn', `Chinese plugin title is "供应商增强" (got ${JSON.stringify(titles.zh)})`, 'restore packages/ui/locale/zh.json')
  } catch (error) {
    report('warn', `plugin locale dictionaries resolve (${error.message})`, 'the Plugins page will fall back to the package name')
  }
}

const version = installedVersion()
if (version === undefined) {
  report('warn', 'installed DSH version (pass --install or set DSH_INSTALL_DIR to check it)')
} else {
  const engine = readJson(join(adapterRepoDir, 'package.json')).engines?.dsh
  const expected = targetVersion(engine)
  check(
    expected === undefined || version === expected,
    'warn',
    `installed DSH ${version} matches the adapter target ${expected ?? 'unknown'}`,
    're-extract and re-patch the adapter for this DSH version (docs/upgrading.md)',
  )
}

if (!existsSync(patchPath)) {
  report('warn', 'profile patch file exists (cordis.patch.yml not found; no provider profiles yet)')
} else {
  const patch = readFileSync(patchPath, 'utf8')
  const names = accountNames(patch)
  const duplicates = duplicateAccountNames(patch)
  check(duplicates.length === 0, 'fail', `configuration names are unique (${names.length} configured)`, `rename or remove duplicate configurations: ${duplicates.join(', ')}`)
  if (names.length > 0 && adapterSpec === undefined) {
    report('fail', `profile has ${names.length} configuration(s) but the patched adapter is not linked`, 'either run `node scripts/install.mjs` or remove the accounts blocks with `node scripts/uninstall.mjs`')
  }
}

function print() {
  const order = { fail: 0, warn: 1, ok: 2 }
  for (const { level, message, fix } of [...results].sort((a, b) => order[a.level] - order[b.level])) {
    const label = level === 'ok' ? '  ok  ' : level === 'warn' ? ' warn ' : ' FAIL '
    console.log(`[${label}] ${message}`)
    if (level !== 'ok' && fix !== undefined) console.log(`         -> ${fix}`)
  }
  const failed = results.filter((result) => result.level === 'fail').length
  const warned = results.filter((result) => result.level === 'warn').length
  console.log(`\n${failed} failure(s), ${warned} warning(s)`)
  if (failed > 0) console.log('See docs/upgrading.md and the README troubleshooting table.')
}

print()
process.exitCode = results.some((result) => result.level === 'fail') ? 1 : 0
