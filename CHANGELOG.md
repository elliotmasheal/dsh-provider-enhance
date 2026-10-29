# Changelog

## Unreleased

## 0.2.1 — 2026-10-29

Open-source readiness; the plugin's behavior is unchanged.

- Split the README into [English](README.md) and [中文](README.zh.md); the
  offline checks now reject Chinese text in `README.md`.
- Added screenshots of the Models page and the chat model picker.
- Added `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`
  and `docs/architecture.md`, plus an unaffiliated-project disclaimer.
- Added `scripts/doctor.mjs`, which diagnoses the profile manifest, the linked
  adapter and bundle, the adapter patch markers, locale metadata, configuration
  names and the installed DSH version.
- `scripts/uninstall.mjs` now removes the `accounts` blocks from the profile's
  `cordis.patch.yml` (after writing a backup) because the bundled adapter
  rejects them; `--keep-accounts` preserves the old behavior.
- CI now runs the header tests against the published DSH `0.2.1-rc.3` packages
  on Linux and Windows instead of skipping them, and checks the npm tarball and
  both Node 22/24.
- Added `scripts/install-test-peers.mjs` (peers for local tests),
  `scripts/pack-check.mjs`, accounts-helper tests, CodeQL, Dependabot and a
  tag-triggered release workflow.
- Both packages are versioned `0.2.1`.

## 0.2.0 — 2026-10-29

- Every configuration of an installed catalog provider now resolves through that
  catalog, including configuration 1. The catalog supplies each known model's
  default protocol, endpoint, compatibility and metadata, while an account's
  explicit `api` / `baseURL` win over those defaults. Configurations now behave
  the same way instead of configuration 1 forcing its protocol.
- Account `headers` merge field by field with the provider's headers, so adding
  one header no longer drops the provider-level ones.
- `x-opencode-session` is reserved on OpenCode routes: the live DSH conversation
  id always wins, and a value written in configuration cannot freeze it.
- Multiple configurations of a hand-declared (non-catalog) provider now resolve
  instead of failing with `names catalog "<provider>", which the installed
  pi-ai catalog does not serve`.
- The Models page keeps the base route visible and hides internal
  `<provider>#<n>` routes; legacy alias routes stay hidden.
- The plugin's display name is localized through `packages/ui/locale/*.json`:
  `ProviderEnhance` in English, `供应商增强` in Chinese.
- Added `tests/headers.test.mjs` (fake fetch against the installed pi-ai) and
  patch-marker checks for the built adapter.
- No separate catalog-alias package is installed or required.

## 0.1.0 — 2026-10-28

First public release.

- Multiple named configurations (accounts) per third-party model provider.
- Configuration 1 is served on the provider's own route id; later configurations
  expand to internal routes that inherit the catalog and provider defaults.
- Chat model list groups follow configuration names; the provider's product name
  is only used as the Models-page row title.
- Per-configuration: API key, endpoint, wire protocol, model list with one-click
  discovery, custom display name.
- Configurations are equal: any of them can be deleted; the list is collapsed by
  default with an accordion editor.
- Duplicate configuration names are rejected client-side and in the adapter.
