# Security policy

ProviderEnhance is a DeepSeek Harness plugin. It runs in-process with the
permissions of the signed-in user, patches the credential-handling model
provider adapter, and writes to the DSH profile. This page describes what that
means and how to report a problem.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.2.x | Yes |
| < 0.2 | No |

The plugin is pinned to one DSH release (`0.2.1-rc.3`); compatibility with other
DSH versions is not a security guarantee.

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Use GitHub's private vulnerability reporting on this repository:
**Security → Advisories → Report a vulnerability**
(<https://github.com/elliotmasheal/dsh-provider-enhance/security/advisories/new>).

Include:

- the affected version/commit and your DSH version,
- a minimal reproduction (redacted configuration and logs),
- the impact you believe it has.

You can expect an acknowledgement within 7 days. We aim to publish a fix or a
mitigation within 90 days, and will credit you unless you ask otherwise.

## What the plugin can do

- **Run code in the DSH process.** The plugin is loaded by DSH's Loader like any
  other bundle; it can do whatever the DSH process can do.
- **Replace the bundled model adapter.** `packages/adapter` is linked as
  `@deepseek-ai/dsh-llm-pi-ai`, so the profile loads the patched copy for every
  pi-ai route, not only routes with multiple configurations.
- **Modify the DSH profile.** The installer edits the profile's `package.json`,
  runs its package manager, and the uninstaller edits `cordis.patch.yml`. Both
  write timestamped backups next to the files they change.
- **Store credentials through DSH.** API keys are written to DSH's credential
  store; the plugin never logs them, and it has no telemetry or analytics.
- **Talk to the endpoints you configure.** Requests go only to the provider
  endpoints in your configuration (and to the catalog the adapter ships).
- **Read a class name in the Models page DOM** (`*_rowActions`) to hide the
  stock Edit button when a provider has several configurations.

## Out of scope

- Vulnerabilities in DeepSeek Harness itself, its bundled adapter, or pi-ai.
  Report those to the DeepSeek Harness project.
- Compromise of the user's machine or DSH profile by other software.
- A provider endpoint leaking or misusing keys you gave it.
- Users running code or configurations they do not trust.

## Supply chain

The plugin has no runtime npm dependencies. `scripts/install-test-peers.mjs`
downloads the published DSH `0.2.1-rc.3` packages **for tests only**, into
`.test-dsh/` (git-ignored). The adapter copy is committed and reviewed through
`docs/upgrading.md`.
