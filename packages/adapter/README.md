# `@deepseek-ai/dsh-llm-pi-ai` (patched)

This directory is a **drop-in replacement** for the adapter package bundled
with DeepSeek Harness. It is not published to npm: the installer links it into
a profile under its upstream package name so the loader resolves it for the
existing `llm-pi-ai` row.

## Contract

- Keep the package name, peer dependency ranges, and `lib/index.js` export
  shape — the loader imports the package by name.
- One provider profile is the container: `displayName` is the provider's own
  product name and is not authoritative for chat; `accounts[]` are the
  configurations.
- `accounts[0]` is served on the base route id; later entries expand to
  `<provider>#<n>`. Session logs and `agent-default-model` keep referencing the
  base id.
- Peer dependencies are resolved by the harness runtime; never bundle them.

## Regenerating after a DSH upgrade

`lib/index.js` is a built artifact. See [`docs/upgrading.md`](../../docs/upgrading.md).
Re-extracting the upstream file replaces this one and drops the patches listed
in `NOTICE.md`, so re-apply them afterwards.
