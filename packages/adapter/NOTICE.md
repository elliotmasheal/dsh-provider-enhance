# NOTICE — patched adapter

`lib/index.js` is a modified copy of `@deepseek-ai/dsh-llm-pi-ai`
(MIT, Copyright (c) 2026 DeepSeek), extracted from an installed DeepSeek Harness
build (`resources/app.asar`). It incorporates catalog-field groundwork from an
earlier MIT-licensed alias fork (Copyright (c) 2026 Dax233). No alias package is
installed or required at runtime.

This fork adds:

1. `accounts` in the provider-profile schema: an array of
   `{ name, apiKeyEnv, catalog?, api?, baseURL?, models?, modelOverrides?, compat?, headers?, retryPolicy? }`.
2. `accountOverrides()` — blank values in an account (`models: []`,
   `headers: {}`) are dropped so the account inherits the profile defaults
   instead of replacing them with emptiness.
3. `overlayAccount()` — account headers merge field by field with the
   provider's headers; every other field replaces wholesale.
4. `inheritedCatalog()` — every account route of an installed catalog provider,
   including the base route, inherits that catalog; a hand-declared provider
   inherits none.
5. `expandAccounts()` — `accounts[0]` stays on the base route id
   (`<provider>`), later entries become internal routes `<provider>#<n>`, all
   inheriting the profile defaults and the catalog. Duplicate configuration
   names throw a configuration error.
6. `catalogServesModels()` — the catalog provider is reused only when it
   implements every model's protocol; otherwise the route keeps the
   hand-declared provider.
7. `requestHeaders()` — reserves `x-opencode-session` on OpenCode routes so the
   live conversation id always wins, and keeps attribution (`user-agent`)
   authoritative as before.
8. `configName` on the resolved profile: the chat-facing name of configuration
   1, so the provider's own product name never doubles as a model-list group.
9. `providerInfo()` returns `configName ?? displayName`, making chat groups
   follow configuration names.
10. `directoryEntries()` titles catalog providers with pi-ai's product name,
    keeps the base account route visible, and hides internal `#` routes and
    pre-release alias routes.

No other behavior of the upstream adapter is intentionally changed.
