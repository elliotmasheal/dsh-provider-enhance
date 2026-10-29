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

## npm (optional, UI bundle only)

The UI half can be published; the adapter cannot (its package name belongs to
DSH and the override must stay a local link).

```sh
cd packages/ui
npm publish --provenance --access public
```

Only do this once the README explains that the adapter is a separate install
step; otherwise every npm user reports "nothing happens".

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
