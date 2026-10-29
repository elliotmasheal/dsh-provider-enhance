#!/usr/bin/env node
/**
 * Reproduce `packages/adapter/lib/index.js` from the published upstream package
 * plus the patches in `patches/`.
 *
 * This turns a DSH upgrade into "bump the version, re-apply patches, review the
 * diff" instead of hand-editing a 6k-line build artifact:
 *
 *   node scripts/sync-adapter.mjs            # verify the committed file matches
 *   node scripts/sync-adapter.mjs --check    # same, explicit (CI uses this)
 *   node scripts/sync-adapter.mjs --write    # regenerate the committed file
 *   node scripts/sync-adapter.mjs --version 0.2.1-rc.4 --write
 *
 * Requires `npm` and `tar` on PATH. The upstream tarball is fetched from the
 * registry; nothing is installed.
 */
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const adapterDir = join(root, 'packages', 'adapter')
const adapterFile = join(adapterDir, 'lib', 'index.js')
const patchDir = join(root, 'patches')
const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const index = argv.indexOf(name)
  return index === -1 ? fallback : argv[index + 1]
}
const write = argv.includes('--write')
const adapterManifest = JSON.parse(readFileSync(join(adapterDir, 'package.json'), 'utf8'))
const pinned = adapterManifest.engines?.dsh ?? ''
const version = arg('--version', pinned.replace(/^[\^~>=<\s]+/, '').trim())
const patches = existsSync(patchDir)
  ? readdirSync(patchDir).filter((name) => name.endsWith('.patch')).sort()
  : []

function run(command, options) {
  const result = spawnSync(command, { encoding: 'utf8', shell: true, ...options })
  if (result.error !== undefined) throw result.error
  return result
}

function checksum(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

if (version === '') throw new Error('cannot determine the upstream version; pass --version')
if (patches.length === 0) throw new Error(`no patches found in ${patchDir}`)
console.log(`upstream: @deepseek-ai/dsh-llm-pi-ai@${version}`)
console.log(`patches:  ${patches.join(', ')}`)

const work = mkdtempSync(join(tmpdir(), 'provider-enhance-adapter-'))
try {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const pack = run(`${npm} pack "@deepseek-ai/dsh-llm-pi-ai@${version}" --pack-destination "${work}"`, {
    cwd: root,
  })
  const tarball = readdirSync(work).find((name) => name.endsWith('.tgz'))
  if (tarball === undefined) {
    throw new Error(`npm pack produced no tarball\n${pack.stdout}${pack.stderr}`)
  }

  const extract = run(`tar -xzf "${join(work, tarball)}" -C "${work}"`, { cwd: root })
  if (extract.status !== 0) throw new Error(`tar failed\n${extract.stderr}`)
  const packageDir = join(work, 'package')
  const upstreamFile = join(packageDir, 'lib', 'index.js')
  if (!existsSync(upstreamFile)) throw new Error(`upstream tarball has no lib/index.js`)

  for (const name of patches) {
    const patch = join(patchDir, name)
    const check = run(`git apply --check -p1 "${patch}"`, { cwd: packageDir })
    if (check.status !== 0) {
      throw new Error(`patch ${name} does not apply to ${version}\n${check.stderr}`)
    }
    const applied = run(`git apply -p1 "${patch}"`, { cwd: packageDir })
    if (applied.status !== 0) throw new Error(`cannot apply ${name}\n${applied.stderr}`)
  }

  const generated = readFileSync(upstreamFile, 'utf8').replaceAll('\r\n', '\n')
  const committed = existsSync(adapterFile)
    ? readFileSync(adapterFile, 'utf8').replaceAll('\r\n', '\n')
    : undefined
  const same = committed === generated
  console.log(`generated: ${generated.length} bytes, sha256 ${checksum(Buffer.from(generated)).slice(0, 12)}`)
  console.log(`committed: ${committed === undefined ? 'missing' : `${committed.length} bytes, sha256 ${checksum(Buffer.from(committed)).slice(0, 12)}`}`)

  if (write) {
    copyFileSync(upstreamFile, adapterFile)
    console.log(`wrote ${adapterFile}`)
    console.log('Now bump version/engines/peer ranges in packages/adapter/package.json,')
    console.log('update NOTICE.md if the patch list changed, and run the checks.')
    process.exitCode = 0
  } else if (same) {
    console.log('committed adapter matches upstream + patches')
    process.exitCode = 0
  } else {
    console.error('\ncommitted adapter does NOT match upstream + patches')
    console.error('run `node scripts/sync-adapter.mjs --write` after reviewing the upstream diff')
    process.exitCode = 1
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
