# dsh-provider-enhance

Browser half of this repository: a DeepSeek Harness Web client plugin that
renders the configuration list inside the Models settings page.

- Bundle manifest: `package.json` → `dsh.bundle.patch` (`cordis.patch.yml`).
- Display name: `locale/en.json` (`ProviderEnhance`) and `locale/zh.json`
  (`供应商增强`) carry `meta.title`, which DSH shows in the Plugins page and the
  Settings plugin list. The package name stays `dsh-provider-enhance` because it
  is also the client module id and the patch row name.
- Client manifest: `package.json` → `dsh.client`; `client.js` registers a keyed
  occupant on the `settings.models.provider-card` slot with key
  `llm-pi-ai` (and `include:llm-pi-ai` as a compatibility alias).
- The module id in `client.js` must equal this package's `name`.

It depends on the patched adapter in `../adapter` for the `accounts` model; the
UI alone does nothing.
