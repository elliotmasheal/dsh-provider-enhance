# NOTICE

This repository ships one modified upstream artifact and one original plugin.

## `packages/adapter/lib/index.js`

A modified copy of `@deepseek-ai/dsh-llm-pi-ai` (MIT License, Copyright (c)
2026 DeepSeek), extracted from an installed DeepSeek Harness build
(`resources/app.asar`) and patched. It incorporates catalog-field groundwork
from an earlier MIT-licensed alias fork (Copyright (c) 2026 Dax233); that code
now lives here, and no separate alias package is installed or required.

The machine-readable form of these changes is
[`patches/0001-accounts-and-headers.patch`](patches/0001-accounts-and-headers.patch);
`scripts/sync-adapter.mjs` reproduces the committed file from the npm release
plus that patch.

Modifications in this repository:

- `accounts` on a provider profile: every entry becomes one servable route.
  `accounts[0]` keeps the base route id; later entries expand to internal routes
  `<provider>#<n>` that inherit the profile defaults and the catalog.
- `accountOverrides()`: blank values (`models: []`, `headers: {}`) in an account
  mean "inherit", not "replace with emptiness".
- `overlayAccount()`: account headers merge field by field with the provider's
  headers instead of replacing the dictionary, so an account that adds one
  header keeps every provider-level header.
- `inheritedCatalog()`: every configuration of an installed catalog provider —
  including configuration 1 — resolves through that catalog. A hand-declared
  provider inherits no catalog (naming its own id would fail resolution), so
  multiple accounts of a custom endpoint work too.
- `catalogServesModels()`: the catalog provider is reused only when it
  implements every model's wire protocol; a forced protocol it does not serve
  keeps the hand-declared provider instead of failing dispatch.
- `requestHeaders()` reserves `x-opencode-session` on OpenCode catalog routes,
  so a configured value can never replace the live conversation id that
  pi-ai's OpenCode provider injects.
- `directoryEntries()` keeps the base route visible even though it now carries
  a catalog id, and hides internal `<provider>#<n>` routes as well as
  pre-release alias routes (a catalog without an account name).
- `configName`: the display name of configuration 1, so the provider's own
  product name (`displayName`) never doubles as a chat group name.
- `providerInfo()` reports `configName ?? displayName`, so chat groups follow
  configuration names.
- Duplicate configuration names are rejected inside `expandAccounts()`.

Everything else in this repository is original work by 有彭 (Youpeng,
https://github.com/elliotmasheal) under the MIT license in `LICENSE`.
