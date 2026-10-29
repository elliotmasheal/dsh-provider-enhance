## Summary

<!-- What does this change and why? -->

## Type

- [ ] Bug fix
- [ ] Feature (UI, adapter, installer)
- [ ] Documentation / packaging
- [ ] Compatibility update for a new DSH version

## Testing

- [ ] `node scripts/check.mjs` passes
- [ ] `node scripts/pack-check.mjs` passes (needed when `packages/ui` changes)
- [ ] `npm test` passes; when the adapter changed, also with test peers:
      `node scripts/install-test-peers.mjs` and
      `DSH_APP_NODE_MODULES=.test-dsh/node_modules npm test`
- [ ] `node scripts/doctor.mjs --profile <scratch>` reports no failure
- [ ] Installed into a scratch profile and the Models page renders
- [ ] Two configurations of one provider both answer requests (when routing changed)
- [ ] Screenshots or a short recording for UI changes

## Checklist

- [ ] No API keys, account names, or personal absolute paths are included
- [ ] `NOTICE.md` / `LICENSE` still describe every upstream file this change touches
- [ ] `CHANGELOG.md` updated
- [ ] `README.md` and `README.zh.md` stay in sync (and unmixed)
- [ ] If the adapter changed, the patches in `docs/upgrading.md` are still accurate
- [ ] The marker strings in `scripts/check.mjs` and `scripts/doctor.mjs` still match
