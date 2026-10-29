#!/usr/bin/env node
/**
 * Header contract of the patched adapter, exercised against a real pi-ai
 * installation.
 *
 * The adapter is a built artifact with no test-only exports, so this suite
 * copies `lib/index.js` into a temporary module beside a link to the harness's
 * own `node_modules` and appends the internal exports it needs. Nothing is
 * written into the DSH installation or into this repository.
 *
 * The runtime tests need a DeepSeek Harness installation. Point the suite at
 * one with either environment variable:
 *
 *   DSH_INSTALL_DIR=/path/to/DeepSeek Harness
 *   DSH_APP_NODE_MODULES=/path/to/DeepSeek Harness/resources/app/dsh/node_modules
 *
 * Without one every test is skipped, which is what CI does.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const adapterSource = readFileSync(join(root, 'packages', 'adapter', 'lib', 'index.js'), 'utf8')
const ATTRIBUTION_UA = 'deepseek-harness/'

/** The harness `node_modules` the adapter's bare imports resolve against. */
function harnessModules() {
  const candidates = [
    process.env.DSH_APP_NODE_MODULES,
    process.env.DSH_INSTALL_DIR === undefined
      ? undefined
      : join(process.env.DSH_INSTALL_DIR, 'resources', 'app', 'dsh', 'node_modules'),
    process.env.DSH_APP === undefined ? undefined : join(process.env.DSH_APP, 'dsh', 'node_modules'),
  ].filter((candidate) => candidate !== undefined && candidate.length > 0)
  return candidates.find(
    (candidate) =>
      existsSync(join(candidate, '@deepseek-ai', 'dsh-llm')) &&
      existsSync(join(candidate, '@earendil-works', 'pi-ai')),
  )
}

const modules = harnessModules()
const skip =
  modules === undefined
    ? 'no DeepSeek Harness installation; set DSH_INSTALL_DIR or DSH_APP_NODE_MODULES'
    : false

let shimDir
let adapter
if (modules !== undefined) {
  shimDir = mkdtempSync(join(tmpdir(), 'dsh-provider-enhance-headers-'))
  symlinkSync(modules, join(shimDir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  writeFileSync(
    join(shimDir, 'adapter.mjs'),
    `${adapterSource}\nexport { resolveProfiles, requestHeaders, directoryEntries };\n`,
  )
  adapter = await import(pathToFileURL(join(shimDir, 'adapter.mjs')).href)
}

test.after(() => {
  if (shimDir !== undefined) rmSync(shimDir, { recursive: true, force: true })
})

const accounts = [
  { name: 'primary', apiKeyEnv: 'OPENCODE_GO_API_KEY' },
  { name: 'secondary', apiKeyEnv: 'OPENCODE_GO_2_API_KEY' },
]

function profilesOf(providers) {
  return adapter.resolveProfiles(providers, 'deferred')
}

/** Perform one stream call and return the request the provider put on the wire. */
async function sentRequest(profile, modelId, sessionId) {
  const model = profile.piProvider?.getModels().find((candidate) => candidate.id === modelId)
  assert.ok(model, `route ${profile.provider} serves ${modelId}`)
  const requests = []
  try {
    await profile.piProvider
      .streamSimple(
        model,
        { messages: [{ role: 'user', content: 'hi' }] },
        {
          apiKey: 'sk-test',
          sessionId,
          headers: adapter.requestHeaders(profile.headers, profile.catalog ?? profile.provider),
          fetch: async (url, init) => {
            requests.push({
              url: String(url),
              headers: Object.fromEntries(new Headers(init?.headers ?? {}).entries()),
            })
            return new Response('', { status: 200, headers: { 'content-type': 'text/event-stream' } })
          },
        },
      )
      .result()
  } catch {
    // The fake endpoint sends no events; only the request headers matter here.
  }
  assert.equal(requests.length, 1, `route ${profile.provider} made one request`)
  return requests[0]
}

/** {@link sentRequest}, headers only. */
async function sentHeaders(profile, modelId, sessionId) {
  return (await sentRequest(profile, modelId, sessionId)).headers
}

test('OpenCode accounts send the live session header on every configuration', { skip }, async () => {
  const profiles = profilesOf({ 'opencode-go': { apiKeyEnv: 'K', accounts } })
  for (const route of ['opencode-go', 'opencode-go#2']) {
    const headers = await sentHeaders(profiles.get(route), 'deepseek-v4.1-flash', 'ses_primary')
    assert.equal(headers['x-opencode-session'], 'ses_primary', route)
    assert.ok(headers['user-agent'].startsWith(ATTRIBUTION_UA), route)
  }
})

test('a protocol override on configuration 1 keeps the session header', { skip }, async () => {
  const profiles = profilesOf({
    'opencode-go': { apiKeyEnv: 'K', api: 'openai-completions', accounts },
  })
  const headers = await sentHeaders(profiles.get('opencode-go'), 'deepseek-v4.1-flash', 'ses_override')
  assert.equal(headers['x-opencode-session'], 'ses_override')
})

test('a catalog provider with no accounts keeps the session header too', { skip }, async () => {
  const profiles = profilesOf({
    'opencode-go': { apiKeyEnv: 'K', api: 'openai-completions' },
  })
  const headers = await sentHeaders(profiles.get('opencode-go'), 'deepseek-v4.1-flash', 'ses_solo')
  assert.equal(headers['x-opencode-session'], 'ses_solo')
})

test('configuration endpoint and protocol overrides win over the catalog', { skip }, async () => {
  const profiles = profilesOf({
    'opencode-go': {
      apiKeyEnv: 'K',
      api: 'openai-completions',
      baseURL: 'https://proxy.test/v1',
      accounts,
    },
  })
  const request = await sentRequest(profiles.get('opencode-go'), 'claude-haiku-5-5', 'ses_proxy')
  assert.equal(request.headers['x-opencode-session'], 'ses_proxy')
  assert.ok(request.url.startsWith('https://proxy.test/v1'), request.url)
})

test('the session header follows the conversation, not the account', { skip }, async () => {
  const profiles = profilesOf({ 'opencode-go': { apiKeyEnv: 'K', accounts } })
  const first = await sentHeaders(profiles.get('opencode-go'), 'deepseek-v4.1-flash', 'ses_one')
  const again = await sentHeaders(profiles.get('opencode-go'), 'deepseek-v4.1-flash', 'ses_one')
  const second = await sentHeaders(profiles.get('opencode-go'), 'deepseek-v4.1-flash', 'ses_two')
  assert.equal(first['x-opencode-session'], 'ses_one')
  assert.equal(again['x-opencode-session'], 'ses_one')
  assert.equal(second['x-opencode-session'], 'ses_two')
})

test('account headers merge with provider headers and cannot replace attribution', { skip }, async () => {
  const profiles = profilesOf({
    'opencode-go': {
      apiKeyEnv: 'K',
      headers: { 'x-provider': 'provider', 'x-shared': 'provider' },
      accounts: [
        {
          name: 'primary',
          apiKeyEnv: 'K',
          headers: { 'x-account': 'account', 'x-shared': 'account', 'User-Agent': 'my-coding-agent/1.0' },
        },
        accounts[1],
      ],
    },
  })
  assert.deepEqual(profiles.get('opencode-go').headers, {
    'x-provider': 'provider',
    'x-shared': 'account',
    'x-account': 'account',
    'User-Agent': 'my-coding-agent/1.0',
  })
  const headers = await sentHeaders(profiles.get('opencode-go'), 'deepseek-v4.1-flash', 'ses_headers')
  assert.equal(headers['x-provider'], 'provider')
  assert.equal(headers['x-account'], 'account')
  assert.equal(headers['x-shared'], 'account')
  assert.ok(headers['user-agent'].startsWith(ATTRIBUTION_UA))
})

test('a pinned session header is replaced by the live conversation id', { skip }, async () => {
  const profiles = profilesOf({
    'opencode-go': { apiKeyEnv: 'K', headers: { 'X-OpenCode-Session': 'pinned' } },
  })
  const headers = await sentHeaders(profiles.get('opencode-go'), 'deepseek-v4.1-flash', 'ses_live')
  assert.equal(headers['x-opencode-session'], 'ses_live')
})

test('a hand-declared provider keeps two accounts and its own headers', { skip }, async () => {
  const profiles = profilesOf({
    'my-gateway': {
      apiKeyEnv: 'K',
      api: 'openai-completions',
      baseURL: 'https://gateway.test/v1',
      headers: { 'x-gateway': 'yes', 'x-opencode-session': 'mine' },
      models: [{ id: 'test-model', name: 'Test', contextWindow: 4096, maxTokens: 512 }],
      accounts,
    },
  })
  assert.ok(profiles.has('my-gateway#2'))
  const headers = await sentHeaders(profiles.get('my-gateway#2'), 'test-model', 'ses_custom')
  assert.equal(headers['x-gateway'], 'yes')
  assert.equal(headers['x-opencode-session'], 'mine')
})

test('the provider directory exposes the base route but not internal routes', { skip }, async () => {
  const profiles = profilesOf({
    'opencode-go': { apiKeyEnv: 'K', accounts },
    'opencode-go-legacy': { catalog: 'opencode-go', apiKeyEnv: 'K2' },
  })
  const routes = adapter.directoryEntries(profiles, 'llm-pi-ai').map((entry) => entry.provider)
  assert.ok(routes.includes('opencode-go'))
  assert.ok(!routes.includes('opencode-go#2'))
  assert.ok(!routes.includes('opencode-go-legacy'))
})
