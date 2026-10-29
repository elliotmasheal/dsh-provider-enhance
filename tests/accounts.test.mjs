#!/usr/bin/env node
/**
 * Offline tests for the `accounts` helpers used by the uninstaller and the
 * doctor: they rewrite user-authored YAML without a parser, so the block
 * boundaries are the whole contract.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  accountNames,
  duplicateAccountNames,
  stripAccounts,
} from '../scripts/lib/accounts.mjs'

const PROFILE = `# profile patch
- id: ui-chat
  name: "@deepseek-ai/dsh-client-ui-chat"
  config:
    transcriptView: detailed
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      opencode-go:
        models:
          - id: deepseek-v4.1-flash
            name: DeepSeek V4.1 Flash
        accounts:
          - name: opencode-go-google
            apiKeyEnv: OPENCODE_GO_API_KEY
            models:
              - id: claude-haiku-5-5
                name: Claude Haiku 5.5
          - name: opencode-go-github
            apiKeyEnv: OPENCODE_GO_2_API_KEY
        displayName: opencode-go
      my-gateway:
        apiKeyEnv: GATEWAY_KEY
        baseURL: https://gateway.test/v1
    someOtherKey: true
- id: agent-default-model
  name: "@deepseek-ai/dsh-agent-default-model"
  config:
    provider: deepseek-account
`

test('removes the accounts block and keeps every sibling key', () => {
  const { text, removed } = stripAccounts(PROFILE)
  assert.equal(removed, 1)
  assert.ok(!text.includes('accounts:'))
  assert.ok(!text.includes('opencode-go-google'))
  assert.ok(!text.includes('apiKeyEnv: OPENCODE_GO_API_KEY'))
  assert.ok(text.includes('opencode-go:'))
  assert.ok(text.includes('displayName: opencode-go'))
  assert.ok(text.includes('my-gateway:'))
  assert.ok(text.includes('someOtherKey: true'))
  assert.ok(text.includes('provider: deepseek-account'))
  // Everything before and after the llm-pi-ai entry survives untouched.
  assert.ok(text.startsWith('# profile patch\n- id: ui-chat'))
  assert.ok(text.trimEnd().endsWith('provider: deepseek-account'))
})

test('a file without accounts is returned unchanged', () => {
  const text = '- id: ui-chat\n  name: "@deepseek-ai/dsh-client-ui-chat"\n'
  assert.deepEqual(stripAccounts(text), { text, removed: 0 })
})

test('an inline empty accounts value is removed too', () => {
  const text = '- id: x\n  config:\n    providers:\n      p:\n        accounts: []\n        displayName: p\n'
  const { text: stripped, removed } = stripAccounts(text)
  assert.equal(removed, 1)
  assert.ok(!stripped.includes('accounts'))
  assert.ok(stripped.includes('displayName: p'))
})

test('a comment at the same indent ends the block', () => {
  const text = '- id: x\n  config:\n    providers:\n      p:\n        accounts:\n          - name: a\n        # keep me\n        displayName: p\n'
  const { text: stripped } = stripAccounts(text)
  assert.ok(stripped.includes('# keep me'))
  assert.ok(stripped.includes('displayName: p'))
})

test('collects account names and detects duplicates', () => {
  assert.deepEqual(accountNames(PROFILE), ['opencode-go-google', 'opencode-go-github'])
  assert.deepEqual(duplicateAccountNames(PROFILE), [])
  const duplicated = PROFILE.replace('opencode-go-github', 'opencode-go-google')
  assert.deepEqual(duplicateAccountNames(duplicated), ['opencode-go-google'])
})
