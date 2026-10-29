# ProviderEnhance

[![ci](https://github.com/elliotmasheal/dsh-provider-enhance/actions/workflows/ci.yml/badge.svg)](https://github.com/elliotmasheal/dsh-provider-enhance/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.3-4B32C3)](https://github.com/elliotmasheal/dsh-provider-enhance#兼容性与风险)

[English](README.md) | **中文**

**一个第三方 provider，多条命名配置。** DeepSeek Harness（DSH）的一条模型路由只能绑定一份凭据；ProviderEnhance 把 provider 配置变成一组彼此平等的配置——每条都有自己的名称、API Key、端点、协议和模型清单，聊天页的模型选择器按配置名分组。

> 基于 **DSH Desktop 0.2.1-rc.3**（Windows）开发与测试。适配器部分是内置 `@deepseek-ai/dsh-llm-pi-ai` 的补丁版本；升级 DSH 前请先读[兼容性与风险](#兼容性与风险)。

维护者：[有彭（@elliotmasheal）](https://github.com/elliotmasheal)。

## 截图

![模型页里的多条配置](docs/screenshots/provider-configurations.png)

*模型页：一个 provider 卡片里放多条平等的配置，每条都能独立改 Key、端点、协议和模型。*

![按配置名分组的聊天模型选择器](docs/screenshots/model-picker.png)

*聊天页的模型选择器：模型按配置名分组（`opencode-go-google`、`opencode-go-github`……）。*

## 为什么需要它

DSH 的一条模型路由是一个 `provider` id、一个显示名、一份凭据引用和一份模型清单；同一个路由注册两次会报 `DUPLICATE_ADAPTER`，所以“同一个供应商的两份订阅”在原生界面里做不到。ProviderEnhance 在配置里只保留**一个** provider id，加载时把它的 `accounts` 展开成内部路由：每条配置有自己的凭据和聊天分组，而模型页始终只显示一行 provider。

## 安装

要求：DSH Desktop 0.2.x 的 desktop profile，以及 DSH 自带的 Node/pnpm（脚本会自动查找）。只有用自己的 Node 运行脚本时才需要 Node 22+。

```sh
git clone https://github.com/elliotmasheal/dsh-provider-enhance.git
cd dsh-provider-enhance
node scripts/install.mjs --profile desktop
```

安装脚本会：

1. 把 `packages/adapter` 以 `@deepseek-ai/dsh-llm-pi-ai` 的名字链接进 profile，让加载器对已有的 `llm-pi-ai` 行解析到补丁版适配器；
2. 链接 `packages/ui` 并加入 `dsh.profile.bundles`；
3. 在 profile 里跑它自己的 `pnpm install`（先备份 `package.json` 和 `pnpm-lock.yaml`）。

完成后重启 DSH Desktop。profile 链接的是这个克隆目录，所以不要把目录移走（移走后重跑安装脚本即可）。

可选参数：

- `--dry-run`：只打印 manifest 变化，不写入；
- `--no-install`：跳过 pnpm，由你在 profile 里自行执行；
- `--home <DSH_HOME>`：使用非默认的 harness 目录；
- `--profile <名称>`：安装到 `desktop` 之外的 profile。

安装脚本会修改 profile manifest，如果你把 profile 纳入版本管理，建议先跑一次 `--dry-run` 看看改动。

## 使用

1. **设置 → 模型 → 添加模型供应商**，选一个第三方 provider（例如 `opencode-go`），填入第一份订阅的 API Key；
2. 打开这个 provider 的卡片，配置默认收起，点 **+ 添加配置** 添加下一份订阅；
3. 点配置行展开：
   - **name**：聊天页的分组名，同一 provider 内必须唯一；
   - **key**：只写不读，保存在 DSH 的凭据库；
   - **自定义设置**：端点、线协议、模型清单，支持 **一键获取模型**（catalog provider 走目录查询，自定义端点走 `GET {baseURL}/models`）；
   - **保存**、**删除**：配置彼此平等，删掉第一条会自动由下一条接管基础路由，provider 自己的名称不受影响。
4. 聊天页：模型选择器按配置名分组；供应商自己的产品名只作为模型页的行标题。

## 配置模型

```yaml
providers:
  opencode-go:                 # 配置里唯一的 provider id
    models: [...]              # provider 默认值，被各条配置继承
    accounts:                  # 配置 1 … N，按顺序
      - name: opencode-go-google
        apiKeyEnv: OPENCODE_GO_API_KEY
      - name: opencode-go-github
        apiKeyEnv: OPENCODE_GO_2_API_KEY
      - name: opencode-go-work
        apiKeyEnv: OPENCODE_GO_3_API_KEY
        baseURL: https://opencode.ai/zen/go
        api: openai-completions
```

- `accounts[0]` 使用基础路由 id（`opencode-go`），所以 `agent-default-model` 和历史会话记录不受影响；第 2…N 条展开成内部路由 `opencode-go#2`、`#3`，继承 profile 和 catalog。
- 已安装 catalog 的 provider，其每条配置（包括第一条）都通过该 catalog 解析：catalog 提供每个已知模型的默认协议、端点、兼容性和元数据；配置里显式写的 `api` / `baseURL` 优先，`models` 替换实际服务的清单。这样第一条和后续配置行为一致，不会出现“第一条强制用自己的协议”。
- 配置里的 `models` / `compat` / `headers` / `retryPolicy` 覆盖 profile 默认值；留空表示继承。`headers` 与 provider 级逐字段合并。
- 配置名在同一 provider 内必须唯一（客户端和适配器都会校验）；删完最后一条会移除该 provider 条目。
- 第一条配置的显示名保存在 `configName` 里，provider 的产品名不会兼作聊天分组名。

## 请求头

每次 provider 请求都带 harness 身份、配置的 headers，以及 pi-ai 按协议补的头：

- `user-agent` 固定为 `deepseek-harness/<版本> (+url)`；配置里写同名头会被丢弃，避免伪装来源。
- 配置级 headers 与 provider 级逐字段合并，所以某条配置只加一个头不会把 provider 级的头整组覆盖掉。
- OpenCode catalog 路由（`opencode-go`、`opencode`）由 pi-ai 注入 `x-opencode-session`，值是当前 DSH 会话 id。这个头名被保留：配置里写死也会被丢弃，保证每个会话用自己的 id。会话 id 在同一会话内稳定（含 resume、压缩、标题请求），新会话或子代理才会变。
- Responses 协议的模型还会由 pi-ai 带上 `x-client-request-id`（同会话 id）。
- 手写（非 catalog）provider 的 headers 原样保留，包括自定义会话头，因为不经过 OpenCode provider 包装。

## 兼容性与风险

- **只适配 DSH 0.2.1-rc.3。** `packages/adapter/lib/index.js` 是从该版本提取并打补丁的构建产物。DSH 升级后要重新提取上游并按 [docs/upgrading.md](docs/upgrading.md) 重新打补丁，否则插件会加载失败或丢失多配置能力。
- **适配器按包名覆盖内置包**，这是插件替换内置实现的唯一方式；代价是 DSH 升级后必须重新链接。这个覆盖对整个 profile 生效，不只是用了多配置的 provider。
- **模型页自带的“编辑”按钮**在多配置时通过 DOM 查找（`*_rowActions`）隐藏。未来版本若改了类名，按钮会重新出现，不影响其它功能。
- **官方“添加模型供应商”下拉**只列未配置的 provider；给已有 provider 加配置要用卡片里的 **+ 添加配置**，这是页面内部过滤，slot 无法扩展。
- **旧版单 provider 配置不会自动迁移**：加一条配置，把原来的 Key 粘贴一次即可。
- **平台支持**：目前只在 Windows 上测试过。脚本使用可移植的 Node API，但 macOS/Linux 尚未验证。
- **安全**：插件在 DSH 进程内以用户权限运行，并且会写 profile；详见 [SECURITY.md](SECURITY.md)。

本项目与 DeepSeek 无隶属关系，也未获其背书或赞助。

## 故障排查

先跑诊断脚本：

```sh
node scripts/doctor.mjs --profile desktop
```

它会检查 profile manifest、适配器和 UI 的链接、适配器补丁标记、`accounts` 配置块，以及已安装的 DSH 版本。

常见问题：

| 现象 | 可能原因 |
| --- | --- |
| 模型页里没有配置界面 | UI bundle 不在 `dsh.profile.bundles` 里；重跑安装脚本并重启。 |
| 启动报 “unexpected field `accounts`” | 补丁版适配器没有链接上（例如 DSH 升级后）；重跑安装脚本。 |
| 卸载后 DSH 起不来 | profile 的 `cordis.patch.yml` 里还留着 `accounts` 块；重跑 `node scripts/uninstall.mjs` 或手工删除。 |
| 两条配置同名 | 配置名在同一 provider 内必须唯一，改名即可。 |
| “一键获取模型”没有结果 | 端点没有返回模型；检查 baseURL 和 Key，或手工添加模型。 |

## 卸载

```sh
node scripts/uninstall.mjs --profile desktop
```

脚本会移除适配器和 UI 依赖、取消勾选 bundle，并且——因为内置适配器不接受未知字段——在备份后删除 profile `cordis.patch.yml` 里的 `accounts:` 块。想保留它们就加 `--keep-accounts`。完成后重启 DSH。

## 仓库结构

| 路径 | 内容 |
| --- | --- |
| `packages/adapter` | 补丁版 `@deepseek-ai/dsh-llm-pi-ai`（按包名覆盖内置实现，不发布） |
| `packages/ui` | `dsh-provider-enhance` Web 客户端 bundle 与语言字典 |
| `patches/0001-accounts-and-headers.patch` | 适配器相对 npm 上游版本的补丁 |
| `scripts/install.mjs`、`scripts/uninstall.mjs`、`scripts/doctor.mjs` | 安装、卸载与诊断脚本 |
| `scripts/sync-adapter.mjs` | 从 npm 上游 + 补丁重建 `packages/adapter/lib/index.js` |
| `scripts/check.mjs` | 离线语法/清单/卫生检查（CI 也跑） |
| `tests/headers.test.mjs` | 用 fake fetch 覆盖请求头契约的回归测试 |
| `docs/upgrading.md` | DSH 升级后如何重新打适配器补丁 |
| `docs/architecture.md` | loader 覆盖、slot 注入与路由展开如何配合 |

## 开发

```sh
node scripts/check.mjs
npm test                       # 请求头测试；需要 DSH 安装或下面的 peers
node scripts/install-test-peers.mjs   # 拉取 npm 上已发布的 DSH peer 包
DSH_APP_NODE_MODULES=.test-dsh/node_modules npm test
node scripts/sync-adapter.mjs --check # 适配器是否等于 npm 上游 + 补丁
node scripts/pack-check.mjs           # 发布包内容是否完整
```

`check.mjs` 校验 JavaScript 语法、清单、补丁标记，并扫描仓库里是否混入个人绝对路径或疑似密钥。CI 会在 Linux 和 Windows 上跑同样的检查，并用 npm 上发布的 DSH `0.2.1-rc.3` 包真正执行请求头测试。

欢迎贡献，见 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。

## 许可证

MIT。`packages/adapter/lib/index.js` 是 `@deepseek-ai/dsh-llm-pi-ai`（MIT，Copyright (c) 2026 DeepSeek）的修改副本，详见 [LICENSE](LICENSE) 与 [NOTICE.md](NOTICE.md)。
