# Publishing checklist

Repository: <https://github.com/elliotmasheal/dsh-provider-enhance>

## First push

```sh
git config user.name  "有彭"
git config user.email "<your email>"
git add -A
git commit -m "feat: dsh provider enhance 0.2.0"
git remote add origin https://github.com/elliotmasheal/dsh-provider-enhance.git
git push -u origin main
```

## Repository metadata

```sh
gh repo edit elliotmasheal/dsh-provider-enhance \
  --description "Multiple named configurations (subscriptions/accounts) per third-party model provider for DeepSeek Harness." \
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

Suggested About text: the description above; website can be left empty or point
at the README anchor `#install`.

## Release

```sh
git tag v0.2.0
git push origin v0.2.0
gh release create v0.2.0 --title "dsh provider enhance 0.2.0" --notes-file CHANGELOG.md
```

## Screenshots

Add images under `docs/screenshots/` and replace the commented block in
`README.md`:

- `configurations.png` — provider card with collapsed configurations
- `editor.png` — one configuration expanded (name, key, customized settings)
- `chat-groups.png` — chat model list grouped by configuration names

## After a DSH upgrade

1. Follow `docs/upgrading.md` to re-patch `packages/adapter/lib/index.js`.
2. Bump `version` / `engines.dsh` / every peer range in
   `packages/adapter/package.json`.
3. Bump the badge and compatibility notes in `README.md`.
4. `node scripts/check.mjs` and `DSH_INSTALL_DIR=<install> npm test`; install into a scratch profile and verify one request
   per wire protocol.
5. Update `CHANGELOG.md`, tag, release.
