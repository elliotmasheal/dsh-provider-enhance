# Publishing checklist

Repository: <https://github.com/elliotmasheal/dsh-provider-enhance>

## Before flipping the repository public

1. `git status` is clean and CI is green on both Linux and Windows.
2. No secrets in the tree or in `git log -p`:
   `git grep -nE 'sk-[A-Za-z0-9]{20,}|ghp_|github_pat_'` and a secret scanner
   (GitHub secret scanning or `gitleaks detect`).
3. README screenshots contain no keys, account names or personal paths.
4. `LICENSE`, `NOTICE.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` and
   `CONTRIBUTING.md` are present and linked from the README.
5. The repository description, homepage and topics are set (below).
6. Branch protection on `main` requires the `ci` checks.

## Repository metadata

```sh
gh repo edit elliotmasheal/dsh-provider-enhance \
  --description "One third-party provider, many named configurations, inside DeepSeek Harness's Models page." \
  --homepage "https://github.com/elliotmasheal/dsh-provider-enhance#install" \
  --add-topic deepseek-harness \
  --add-topic dsh \
  --add-topic dsh-plugin \
  --add-topic pi-ai \
  --add-topic opencode-go \
  --add-topic multi-account \
  --add-topic provider-config \
  --add-topic model-management \
  --enable-issues \
  --enable-discussions=false
```

Then: Settings → Code security → enable **Private vulnerability reporting**,
**Dependabot alerts** and **Secret scanning** (free for public repositories).
Optionally upload a social preview image (the Models-page screenshot works).

## Release

1. Bump `version` in the root `package.json` and `packages/ui/package.json`
   together (the adapter keeps the upstream version it mirrors).
2. Move `CHANGELOG.md`'s `Unreleased` notes under the version and add the date.
3. Commit, then:

```sh
git tag vX.Y.Z
git push origin main vX.Y.Z
```

The `release` workflow creates the GitHub release with generated notes.

## npm (UI bundle only)

The UI half is published as
[`dsh-provider-enhance`](https://www.npmjs.com/package/dsh-provider-enhance);
the adapter cannot be published (its package name belongs to DSH and the
override must stay a local link).

`packages/ui/package.json` pins `publishConfig.registry` to
`https://registry.npmjs.org/` and `access: public`, so a local mirror registry
(such as `registry.npmmirror.com`) can never receive the publish.

To release a new version:

1. bump `packages/ui/package.json` (and the root `package.json` with it);
2. update `CHANGELOG.md` and both READMEs;
3. `cd packages/ui && npm publish`;
4. verify with
   `npm view dsh-provider-enhance version dist-tags --registry=https://registry.npmjs.org`
   and `npm pack dsh-provider-enhance@<version>`.

The account has `auth-and-writes`, so a plain publish needs an OTP or a token
with bypass enabled. Do not commit a token or put it in a workflow file; use
npm's trusted publishing for CI later.

A new package may briefly appear as `0.0.0-stage` while npm processes the
upload; the real version becomes `latest` once processing finishes.

## After a DSH upgrade

1. Set the new `engines.dsh` / peer ranges in `packages/adapter/package.json`,
   then run `node scripts/sync-adapter.mjs --write` and review `git diff patches/`
   (see [upgrading.md](upgrading.md)).
2. Bump the badge and compatibility notes in both READMEs.
3. `node scripts/check.mjs`, `node scripts/sync-adapter.mjs --check`,
   `node scripts/install-test-peers.mjs`,
   `DSH_APP_NODE_MODULES=.test-dsh/node_modules npm test`,
   `node scripts/pack-check.mjs`.
4. Install into a scratch profile, run `node scripts/doctor.mjs`, and verify one
   request per wire protocol.
5. Update `CHANGELOG.md`, tag, release.
