#!/usr/bin/env node
/**
 * Offline checks that do not need a DSH installation:
 * syntax, manifests, patch/module wiring, and accidental personal paths or
 * secrets in the published tree.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const warnings = []

function fail(message) {
  failures.push(message)
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`${path}: ${error.message}`)
    return undefined
  }
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue
    const path = join(dir, entry)
    const info = statSync(path)
    if (info.isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}

const files = walk(root)

// 1. JavaScript syntax (module goal).
const temp = mkdtempSync(join(tmpdir(), 'dsh-provider-configs-check-'))
try {
  for (const file of files.filter((path) => extname(path) === '.js' || extname(path) === '.mjs')) {
    const copy = join(temp, `${relative(root, file).replace(/[\\/]/g, '_')}.mjs`)
    copyFileSync(file, copy)
    try {
      execFileSync(process.execPath, ['--check', copy], { stdio: 'pipe' })
    } catch (error) {
      fail(`${relative(root, file)}: syntax error\n${error.stderr?.toString() ?? error.message}`)
    }
  }
} finally {
  rmSync(temp, { recursive: true, force: true })
}

// 2. Manifests and wiring.
const uiManifest = readJson(join(root, 'packages', 'ui', 'package.json'))
const adapterManifest = readJson(join(root, 'packages', 'adapter', 'package.json'))

if (uiManifest !== undefined) {
  if (uiManifest.name !== 'dsh-provider-enhance') fail('packages/ui/package.json: unexpected name')
  if (uiManifest.license !== 'MIT') fail('packages/ui/package.json: license must be MIT')
  if (uiManifest.dsh?.bundle?.patch !== './cordis.patch.yml') fail('packages/ui/package.json: dsh.bundle.patch')
  if (uiManifest.dsh?.client?.platform !== 'web') fail('packages/ui/package.json: dsh.client.platform')
  if (!Array.isArray(uiManifest.dsh?.client?.inject)) fail('packages/ui/package.json: dsh.client.inject')
  if (uiManifest.exports?.['./locale/*.json'] !== './locale/*.json') {
    fail('packages/ui/package.json: exports must expose ./locale/*.json')
  }
  if (!Array.isArray(uiManifest.files) || !uiManifest.files.includes('locale/*.json')) {
    fail('packages/ui/package.json: files must include "locale/*.json"')
  }
}

// The installed plugin name shown by DSH comes from these locale dictionaries.
const uiLocaleEn = readJson(join(root, 'packages', 'ui', 'locale', 'en.json'))
const uiLocaleZh = readJson(join(root, 'packages', 'ui', 'locale', 'zh.json'))
if (uiLocaleEn !== undefined && uiLocaleEn.meta?.title !== 'ProviderEnhance') {
  fail('packages/ui/locale/en.json: meta.title must be ProviderEnhance')
}
if (uiLocaleZh !== undefined && uiLocaleZh.meta?.title !== '供应商增强') {
  fail('packages/ui/locale/zh.json: meta.title must be 供应商增强')
}
if (adapterManifest !== undefined) {
  if (adapterManifest.name !== '@deepseek-ai/dsh-llm-pi-ai') fail('packages/adapter/package.json: unexpected name')
  if (adapterManifest.license !== 'MIT') fail('packages/adapter/package.json: license must be MIT')
  if (typeof adapterManifest.engines?.dsh !== 'string') fail('packages/adapter/package.json: engines.dsh')
}

// The adapter is a built artifact regenerated from a DSH release; these markers
// catch a re-extraction that silently dropped the account/header patches.
const adapter = readFileSync(join(root, 'packages', 'adapter', 'lib', 'index.js'), 'utf8')
for (const marker of [
  'function inheritedCatalog(',
  'function overlayAccount(',
  'function catalogServesModels(',
  "A configuration's own protocol and endpoint win over the catalog",
  'const OPENCODE_SESSION_HEADER = "x-opencode-session";',
  'provider.includes("#") || profile.catalog !== void 0 && profile.configName === void 0',
  'requestHeaders(profile.headers, profile.catalog ?? profile.provider)',
]) {
  if (!adapter.includes(marker)) fail(`packages/adapter/lib/index.js: missing patch marker ${marker}`)
}

const client = readFileSync(join(root, 'packages', 'ui', 'client.js'), 'utf8')
if (!client.includes("id: 'dsh-provider-enhance'")) {
  fail('packages/ui/client.js: module id must equal the package name')
}

const patch = readFileSync(join(root, 'packages', 'ui', 'cordis.patch.yml'), 'utf8')
if (!patch.includes("name: 'dsh-provider-enhance'")) {
  fail('packages/ui/cordis.patch.yml: row must insert this package')
}

for (const required of ['LICENSE', 'NOTICE.md', 'README.md', 'CHANGELOG.md', 'packages/adapter/LICENSE', 'packages/adapter/NOTICE.md']) {
  const present = new Set(files.map((file) => relative(root, file).split(sep).join('/')))
  if (!present.has(required)) fail(`missing ${required}`)
}

// 3. Accidental personal paths and secret-like strings.
const textExtensions = new Set(['.js', '.mjs', '.json', '.md', '.yml', '.yaml', '.txt', '.svg'])
const forbidden = [
  { pattern: /[A-Za-z]:[\\/]+Users[\\/]+/i, label: 'absolute user path' },
  { pattern: /[A-Za-z]:[\\/]+programs[\\/]+/i, label: 'absolute program path' },
  { pattern: /sk-[A-Za-z0-9]{20,}/, label: 'secret-like token' },
]
for (const file of files.filter((path) => textExtensions.has(extname(path)))) {
  const text = readFileSync(file, 'utf8')
  for (const { pattern, label } of forbidden) {
    if (pattern.test(text)) fail(`${relative(root, file)}: contains a ${label}`)
  }
}

if (failures.length > 0) {
  console.error('checks failed:')
  for (const message of failures) console.error(`- ${message}`)
  process.exitCode = 1
} else {
  console.log(`checks passed (${files.length} files)`)
  for (const message of warnings) console.warn(`warning: ${message}`)
}
