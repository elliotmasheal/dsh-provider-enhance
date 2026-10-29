# dsh provider enhance

[![ci](https://github.com/elliotmasheal/dsh-provider-enhance/actions/workflows/ci.yml/badge.svg)](https://github.com/elliotmasheal/dsh-provider-enhance/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.3-4B32C3)](https://github.com/elliotmasheal/dsh-provider-enhance#compatibility)

**One third-party provider, many named configurations.** DSH (DeepSeek Harness)
binds one credential per provider route; this plugin turns the provider profile
into a container of equally-editable configurations — each with its own name,
API key, endpoint, wire protocol and model list. Chat's model picker groups
models by those configuration names.

English | [中文](#中文)

> Developed and tested against **DSH Desktop 0.2.1-rc.3** (Windows). The adapter
> half is a patched build of the bundled `@deepseek-ai/dsh-llm-pi-ai`; see
> [Compatibility](#compatibility) before upgrading DSH.

Maintained by [有彭 (@elliotmasheal)](https://github.com/elliotmasheal).

## Screenshots

<!-- Add images to docs/screenshots/ and reference them here, for example:

![Configurations](docs/screenshots/configurations.png)
![Collapsed editor](docs/screenshots/editor.png)
![Chat groups](docs/screenshots/chat-groups.png)

-->
Screenshots will be added soon.

```
Settings → Models → OpenCode Go
┌────────────────────────────────────────────────────────────┐
│  ● OpenCode Go · 主号            配置 1                   ▸ │
│  ● OpenCode Go · 副号            配置 2                   ▾ │
│    ┌──────────────────────────────────────────────────┐    │
│    │ name  [OpenCode Go · 副号                      ]  │    │
│    │ key   [••••••••••••••••]  Save  Clear             │    │
│    │ Customized settings ▸                             │    │
│    │                                    [ Save ] [Delete] │
│    └──────────────────────────────────────────────────┘    │
│                  + Add configuration                        │
└────────────────────────────────────────────────────────────┘
```

## Why

A model route in DSH is one `provider` id with one display name, one credential
reference and one model list; registering the same route twice fails with
`DUPLICATE_ADAPTER`. That makes "two subscriptions of the same provider"
impossible with the stock UI. This plugin keeps **one** provider id in
configuration and expands its `accounts` into internal routes at load time, so
each configuration gets its own credential and its own chat group while the
Models page still shows a single provider row.

## Install

Requirements: DSH Desktop 0.2.x with the desktop profile, and the Node/pnpm that
DSH ships (the script finds them). Node 22+ is only needed if you run the script
with your own Node.

```sh
git clone https://github.com/elliotmasheal/dsh-provider-enhance.git
cd dsh-provider-enhance
node scripts/install.mjs --profile desktop
```

The installer:

1. links `packages/adapter` as `@deepseek-ai/dsh-llm-pi-ai` in the profile, so the
   loader resolves the patched adapter for the existing `llm-pi-ai` row;
2. links `packages/ui` and appends it to `dsh.profile.bundles`;
3. runs the profile's own `pnpm install` (backups of `package.json` /
   `pnpm-lock.yaml` are written first).

Restart DSH Desktop afterwards. The profile links to this clone, so keep the
directory where it is (re-run the installer if you move it).

- `--dry-run` prints the manifest changes.
- `--no-install` skips pnpm; run `pnpm install` in the profile yourself.
- `--home <DSH_HOME>` for a non-default harness home.

## Use

1. **Settings → Models → Add model provider**, pick a third-party provider
   (e.g. `opencode-go`) and paste the first subscription's API key.
2. Open that provider's card. Its configurations are listed collapsed; use
   **+ Add configuration** to add the next subscription.
3. Click a configuration row to expand it:
   - **name** — the chat group name (unique within the provider);
   - **key** — stored write-only in DSH's credential store;
   - **Customized settings** — endpoint, wire protocol, model list with
     **Fetch models** (catalog lookup for catalog providers, `GET {baseURL}/models`
     for custom endpoints);
   - **Save**, **Delete** — configurations are peers; deleting the first one
     promotes the next without touching the provider's name.
4. Chat: the model picker shows one group per configuration name. The provider's
   own product name is only used as the Models-page row title.

## Configuration model

```yaml
providers:
  opencode-go:                 # the only route id in configuration
    models: [...]              # provider defaults, inherited by configurations
    accounts:                  # configuration 1 … N, in order
      - name: OpenCode Go · 主号
        apiKeyEnv: OPENCODE_GO_API_KEY
      - name: OpenCode Go · 副号
        apiKeyEnv: OPENCODE_GO_2_API_KEY
      - name: OpenCode Go · 第三份
        apiKeyEnv: OPENCODE_GO_3_API_KEY
        baseURL: https://opencode.ai/zen/go
        api: openai-completions
```

- `accounts[0]` is served on the base route id (`opencode-go`), so
  `agent-default-model` and existing session logs keep working; entries 2…N
  expand to internal routes `opencode-go#2`, `#3` that inherit the profile and
  catalog.
- Every configuration of an installed catalog provider — including the base one
  — resolves through that catalog. The catalog supplies each known model's
  default protocol, endpoint, compatibility and metadata; an account's `api` /
  `baseURL` win over those defaults when set, and `models` replaces the served
  list. Configurations therefore behave identically instead of configuration 1
  forcing its own protocol.
- An account's `models` / `compat` / `headers` / `retryPolicy` override the
  profile defaults; blank values inherit. `headers` merge field by field with
  the provider's headers.
- Configuration names must be unique per provider (client and adapter enforce
  it). Deleting the last configuration removes the provider entry.

## Request headers

Every provider request carries the harness identity, the configuration's
headers, and the protocol headers pi-ai adds:

- `user-agent` is always `deepseek-harness/<version> (+url)`. A configured value
  is dropped so attribution cannot be suppressed.
- Configuration headers merge with the provider's, so one header added on a
  configuration does not remove the provider-level ones.
- On OpenCode catalog routes (`opencode-go`, `opencode`) pi-ai sends
  `x-opencode-session` with the current DSH session id. That name is reserved:
  a configured value is dropped, so every conversation keeps its own id. The
  id is stable for the life of a session (including resume, compaction and the
  session-title request) and differs for a new session or a subagent.
- Models on the Responses protocol also get `x-client-request-id` with the same
  session id from pi-ai.
- A hand-declared provider keeps its own `headers` untouched, including a
  custom session header, because no OpenCode provider wrapper is involved.

## Repository layout

| Path | What |
| --- | --- |
| `packages/adapter` | Patched `@deepseek-ai/dsh-llm-pi-ai` (drop-in override; not published) |
| `packages/ui` | `dsh-provider-enhance` Web client bundle |
| `scripts/install.mjs`, `scripts/uninstall.mjs` | profile installer/remover |
| `scripts/check.mjs` | offline syntax/manifest/hygiene checks (also runs in CI) |
| `tests/headers.test.mjs` | fake-fetch regression tests for the header contract |
| `docs/upgrading.md` | how to re-patch the adapter after a DSH update |

## Compatibility

- **Pinned to DSH 0.2.1-rc.3.** `packages/adapter/lib/index.js` is a built
  artifact extracted from that build. After a DSH upgrade, re-run the upstream
  extraction and re-apply the patches in `docs/upgrading.md`; the plugin fails to
  load (or loses the accounts feature) otherwise.
- The adapter overrides the bundled package by name, which is the only way a
  plugin can replace it; this also means the override must be re-linked after a
  DSH upgrade.
- The Models page's per-provider **Edit** button is hidden for providers with
  more than one configuration by a DOM lookup (`*_rowActions`). If a future build
  renames that class, the button reappears; nothing else depends on it.
- The stock **Add model provider** dropdown only lists unconfigured providers.
  Adding another configuration of an existing provider happens inside its card
  (`+ Add configuration`); this is a page-internal filter that slots cannot
  extend.
- Provider profiles created by an older single-provider setup are not migrated
  automatically: add a configuration and paste the existing key once.

## Uninstall

```sh
node scripts/uninstall.mjs --profile desktop
```

Then delete any `accounts:` blocks from `llm-pi-ai` provider profiles in the
profile's `cordis.patch.yml` — the stock adapter rejects unknown fields — and
restart DSH.

## Development

```sh
node scripts/check.mjs
DSH_INSTALL_DIR="<DeepSeek Harness install>" npm test
```

Checks JavaScript syntax, manifests, slot/patch wiring, and scans the tree for
personal absolute paths or secret-like strings. CI runs the same checks; the
header tests need a DSH installation (they skip without one) and drive a real
pi-ai provider with a fake fetch.

## License

MIT. `packages/adapter/lib/index.js` is a modified copy of
`@deepseek-ai/dsh-llm-pi-ai` (MIT, Copyright (c) 2026 DeepSeek). See
[LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).

---

## 中文

**一个第三方 provider，多条命名配置。** DSH 的一条模型路由只能有一个 provider
id、一个显示名、一个凭据引用；本插件把 provider 配置变成 `accounts` 容器，每条
配置都有自己的名称、API Key、端点、协议和模型清单，聊天页的模型列表按配置名
分组。

### 安装

```sh
git clone https://github.com/elliotmasheal/dsh-provider-enhance.git
cd dsh-provider-enhance
node scripts/install.mjs --profile desktop
```

脚本会把 `packages/adapter` 以 `@deepseek-ai/dsh-llm-pi-ai` 的名字链接进 profile
（覆盖内置适配器），再链接 `packages/ui` 并加入 `dsh.profile.bundles`，最后用
DSH 自带的 pnpm 安装。完成后**重启 DSH Desktop**。

### 使用

1. 设置 → 模型 → 添加模型供应商，选一个第三方 provider（如 `opencode-go`），填入
   第一份订阅的 Key；
2. 打开该 provider 的卡片，配置默认收起，点「+ 添加配置」添加第二份订阅；
3. 点配置行展开：改名称（即聊天页分组名）、保存 Key、在「自定义设置」里改端点/
   协议/模型（支持「一键获取模型」）、保存或删除；
4. 聊天页的模型列表按配置名分组；供应商名称只作为模型页的行标题。

配置名在同一 provider 内必须唯一；配置彼此平等，删除第一条会自动由下一条接管
基础路由；全部删完后该 provider 条目移除。

每条配置（包括第一条）都通过该 provider 已安装的 catalog 解析：catalog 提供每个已知
模型的默认协议、端点、兼容性与元数据；配置里显式设置的 `api` / `baseURL` 优先于
这些默认值，`models` 替换实际服务的模型清单。这样第一条和后续配置的行为一致。

### 请求头

- `user-agent` 固定为 `deepseek-harness/<版本> (+url)`，配置里写同名头会被丢弃；
- 配置级的 `headers` 与 provider 级逐字段合并，不会整组替换；
- `opencode-go` / `opencode` 路由由 pi-ai 注入 `x-opencode-session`，值是当前
  DSH 会话 id；该头名被保留，配置里写死也会被丢弃。会话 id 在同一会话内（含
  resume、压缩、标题请求）稳定，新会话/子代理才变化；
- Responses 协议还会由 pi-ai 带上 `x-client-request-id`（同会话 id）；
- 手写（非 catalog）provider 的 `headers` 原样保留，包括自定义会话头。

### 兼容性

- 仅适配 DSH **0.2.1-rc.3**；升级 DSH 后需要按 `docs/upgrading.md` 重新提取并
  打补丁，否则插件无法加载或丢失多配置能力；
- 多配置时模型页自带的「编辑」按钮通过 DOM 查找隐藏，未来版本若改类名会重新
  出现，不影响其它功能；
- 官方「添加模型供应商」下拉只列出未配置的 provider，给同一 provider 再加配置请
  用卡片里的「+ 添加配置」。

### 开发

```sh
node scripts/check.mjs
DSH_INSTALL_DIR="<DeepSeek Harness 安装目录>" npm test
```

`check.mjs` 做语法/清单/补丁标记检查；`tests/headers.test.mjs` 用 fake fetch 驱动
真实的 pi-ai，覆盖会话头、头合并与非 catalog provider。没有 DSH 安装时测试跳过。

### 许可证

MIT。`packages/adapter/lib/index.js` 是 `@deepseek-ai/dsh-llm-pi-ai`（MIT，
Copyright (c) 2026 DeepSeek）的修改副本。详见 [LICENSE](LICENSE) 与
[NOTICE.md](NOTICE.md)。
