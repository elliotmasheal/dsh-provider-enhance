# Upgrading the patched adapter

`packages/adapter/lib/index.js` is a **built artifact** extracted from an
installed DSH build and patched. It targets `@deepseek-ai/dsh-llm-pi-ai`
0.2.1-rc.3.

When DSH updates:

1. Extract the new `@deepseek-ai/dsh-llm-pi-ai/lib/index.js` from the installed
   `resources/app.asar` with any asar extractor (for example
   `npx @electron/asar extract resources/app.asar <dir>`), and copy it over
   `packages/adapter/lib/index.js`.
2. Re-apply the patches below in that order.
3. Update `version`, `engines.dsh`, and every peer range in
   `packages/adapter/package.json` to the new build.
4. Run `node scripts/check.mjs` (it fails when a patch marker is missing) and
   the header tests with `DSH_INSTALL_DIR=<install> npm test`.
5. Smoke-test two configurations of one provider.

Running an upstream sync script alone drops every patch; `NOTICE.md` lists the
same changes in prose.

## 1. Profile schema

Inside `const profile = z.object({ ... })` add `configName` and `accounts`:

```js
configName: z.string(),
accounts: z.array(z.object({
  name: z.string().required(),
  apiKeyEnv: z.string().role("credential-ref").required(),
  catalog: z.string(),
  api: z.union(supportedProtocols()),
  baseURL: z.string(),
  models: z.array(modelProfile),
  modelOverrides: z.dict(modelOverride),
  compat: compatProfile,
  headers: z.dict(z.string()),
  retryPolicy: RetryPolicySchema
})),
```

## 2. Blank overrides

Add `accountOverrides()` next to `expandAccounts()`: it drops `undefined`,
`null`, empty arrays and empty objects so an account that never set a field
inherits the profile defaults.

## 3. Catalog inheritance and header merge

Add `inheritedCatalog()` and `overlayAccount()`:

```js
function inheritedCatalog(provider, source) {
  return source.catalog ?? (catalogProvider(provider) === void 0 ? void 0 : provider);
}
function overlayAccount(base, overrides) {
  const merged = { ...base, ...overrides };
  if (base.headers !== void 0 || overrides.headers !== void 0) merged.headers = {
    ...base.headers,
    ...overrides.headers
  };
  return merged;
}
```

## 4. Account expansion

```js
function expandAccounts(providers) { /* ... */ }
```

- no accounts → provider unchanged;
- names are trimmed and must be unique within the provider, otherwise throw;
- `accounts[0]` stays on the base route id and receives `apiKeyEnv` plus
  `configName = accounts[0].name`, and inherits the catalog like every other
  entry;
- later entries become `<provider>#<n>` (n starting at 2), inheriting the base
  profile through `overlayAccount()`, with `catalog` defaulting to
  `inheritedCatalog()` and `displayName = name`.

`resolveProfiles()` must call it before iterating:

```js
const entries = Object.entries(expandAccounts(providers));
```

## 5. Route overrides win over the catalog

In `resolveRouteModels()`, remove the catalog-first conditionals so explicit
configuration values beat catalog defaults (they used to be honored only on a
route without a catalog):

```js
/* A configuration's own protocol and endpoint win over the catalog; the
   catalog supplies the defaults and each known model's metadata. */
const api = request.api ?? base?.api ?? routeApi;
const baseUrl = request.baseURL ?? base?.baseUrl ?? providerBaseUrl;
```

## 6. Catalog provider reuse guard

Before `buildProvider()`, add:

```js
function catalogServesModels(catalogId, models) {
  const apis = new Set([...catalogModels(catalogId).values()].map((model) => model.api));
  return models.every((model) => apis.has(model.api));
}
```

and require it in the reuse condition:

```js
const catalogId = spec.catalog ?? spec.provider;
const catalog = catalogProvider(catalogId);
if (catalog !== void 0 && catalogServesModels(catalogId, spec.models)) return reuseCatalogProvider(catalog, spec);
```

Without the guard, a route that forces a protocol the catalog provider does not
implement would dispatch into a missing API implementation.

## 7. Header reservation

Add the constant and helper next to `requestHeaders()`:

```js
const OPENCODE_SESSION_HEADER = "x-opencode-session";
function openCodeRoute(catalog) {
  return catalog === "opencode" || catalog === "opencode-go";
}
```

`requestHeaders(headers, catalog)` adds `OPENCODE_SESSION_HEADER` to the
case-insensitive reserved set when `openCodeRoute(catalog)` is true, alongside
the attribution headers. Call it from `streamWithSnapshot()` as:

```js
headers: requestHeaders(profile.headers, profile.catalog ?? profile.provider)
```

This is what keeps a configured `x-opencode-session` from freezing the value
that pi-ai's OpenCode provider would otherwise inject per conversation.

## 8. Chat-facing name

```js
providerInfo(provider) {
  const profile = this.current().profiles.get(provider);
  return { id: provider, name: profile?.configName ?? profile?.displayName ?? provider };
}
```

## 9. Models-page rows

In `directoryEntries()`:

```js
const installedName = (provider) => catalogProvider(provider)?.name ?? provider;
for (const provider of catalogProviderIds()) declare(provider, installedName(provider));
for (const [provider, profile] of profiles) {
  if (provider.includes("#") || profile.catalog !== void 0 && profile.configName === void 0) continue;
  const installed = catalogProvider(provider);
  declare(provider, installed === void 0 ? profile.displayName : installed.name, profile.catalogError);
}
```

Catalog providers are titled by pi-ai's product name; the base account route
stays visible even though it carries a catalog id, while internal account routes
and pre-release alias routes stay hidden.
