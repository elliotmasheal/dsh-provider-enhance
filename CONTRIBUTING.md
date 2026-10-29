# Contributing

Thanks for helping ProviderEnhance. Issues and pull requests are welcome in
English or Chinese; the maintainers answer in the language you wrote in.

Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) first.

## What this project is

Two halves that ship together:

- `packages/ui` — the Web client bundle that renders the configuration list in
  the Models settings page, plus the `locale/*.json` dictionaries that give the
  plugin its display name.
- `packages/adapter` — a **patched build** of the bundled
  `@deepseek-ai/dsh-llm-pi-ai`, linked over the original so a provider profile
  can carry `accounts`.

The adapter is generated, not hand-written; see below.

## Set up

```sh
git clone https://github.com/elliotmasheal/dsh-provider-enhance.git
cd dsh-provider-enhance
node scripts/check.mjs
npm test
```

Node 22+ is required. The header tests need a DeepSeek Harness installation:

```sh
# either point the tests at an installed DSH
DSH_INSTALL_DIR="<DeepSeek Harness install>" npm test

# or install the published DSH peer packages (no DSH install needed)
node scripts/install-test-peers.mjs
DSH_APP_NODE_MODULES=.test-dsh/node_modules npm test
```

`node scripts/doctor.mjs --profile desktop` diagnoses an installed profile; it
is also the first thing to ask a bug reporter for.

## Changing the UI

- The client registers into the `settings.models.provider-card` slot. Keep the
  module id in `client.js` equal to the package name (`dsh-provider-enhance`).
- Every visible string goes through the locale dictionaries in `client.js`
  (`zh` / `en`), not into JSX directly.
- The plugin title comes from `packages/ui/locale/*.json` (`meta.title`):
  English `ProviderEnhance`, Chinese `供应商增强`. `scripts/check.mjs` enforces
  both, and that `README.md` has no Chinese text.
- DSH needs a client rebuild/reload to pick up UI changes; run
  `npm run pack:check` to confirm the published tarball still carries
  `client.js`, `cordis.patch.yml`, `icon.svg` and both locale files.

## Changing the adapter

`packages/adapter/lib/index.js` is a build artifact. Do not hand-edit it as a
one-off:

1. extract and patch the upstream build as described in
   [docs/upgrading.md](docs/upgrading.md);
2. keep the patch list in that document and in `NOTICE.md` in sync;
3. keep the marker strings used by `scripts/check.mjs` and
   `scripts/doctor.mjs` intact (or update both lists together);
4. add or extend a test in `tests/headers.test.mjs` for behavior changes;
5. update the pinned version in `packages/adapter/package.json` when DSH moves.

If you change routing or headers, say which wire protocol you exercised in the
pull request.

## Pull requests

- Run `node scripts/check.mjs`, `npm test` and `npm run pack:check`.
- Update `CHANGELOG.md` under `Unreleased` (or the version you are preparing).
- Keep `README.md` (English) and `README.zh.md` (Chinese) consistent. Do not mix
  the two languages in one file; `scripts/check.mjs` fails the build otherwise.
- UI changes need a screenshot or a short recording.
- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`); the release
  notes are grouped from them.

## Releases

1. Bump `version` in the root and `packages/ui` manifests together.
2. Move the `Unreleased` notes of `CHANGELOG.md` under the version and date.
3. `git tag vX.Y.Z && git push origin vX.Y.Z` — the release workflow publishes
   the GitHub release with generated notes.
4. `npm publish` from `packages/ui` only when the UI half is installable on its
   own without the adapter override; until then the installer is the supported
   path.
