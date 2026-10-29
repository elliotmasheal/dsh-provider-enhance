#!/usr/bin/env node
/**
 * Install the published DSH peer packages the adapter imports, so the header
 * tests can run without a DeepSeek Harness installation.
 *
 * The peers come from `packages/adapter/package.json`; their versions are the
 * ranges that file pins. They land in `.test-dsh/` (git-ignored) with their own
 * `package.json`, so the repository root stays dependency-free.
 *
 * Usage:
 *   node scripts/install-test-peers.mjs [--force]
 *
 * Then:
 *   DSH_APP_NODE_MODULES=.test-dsh/node_modules npm test
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, '.test-dsh')
const adapterManifest = JSON.parse(
  readFileSync(join(root, 'packages', 'adapter', 'package.json'), 'utf8'),
)
const peers = adapterManifest.peerDependencies ?? {}
const ready = existsSync(join(target, 'node_modules', '@earendil-works', 'pi-ai'))

if (ready && !process.argv.includes('--force')) {
  console.log('test peers are already installed in .test-dsh (use --force to reinstall)')
} else {
  mkdirSync(target, { recursive: true })
  writeFileSync(
    join(target, 'package.json'),
    `${JSON.stringify({ name: 'dsh-provider-enhance-test-peers', private: true, dependencies: peers }, null, 2)}\n`,
  )
  console.log(`installing ${Object.keys(peers).length} DSH peer packages in .test-dsh`)
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = spawnSync(`${npm} install --prefix "${target}" --no-audit --no-fund`, {
    cwd: root,
    stdio: 'inherit',
    // npm is a .cmd shim on Windows; one command string avoids the shell-args
    // deprecation warning (only the repository path is interpolated).
    shell: true,
  })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    throw new Error(`npm install failed with exit code ${result.status}`)
  }
}

console.log('\nRun the header tests with the peers above:')
console.log('  DSH_APP_NODE_MODULES=.test-dsh/node_modules npm test')
console.log('PowerShell:')
console.log("  $env:DSH_APP_NODE_MODULES='.test-dsh/node_modules'; npm test")
