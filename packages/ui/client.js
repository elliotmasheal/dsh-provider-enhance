window.__ModuleLoader__.load({
  id: 'dsh-provider-enhance',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const SETTINGS_NS = 'llm-pi-ai'
    const NS = 'models-provider-configs'
    const PROTOCOLS = ['', 'openai-completions', 'openai-responses', 'anthropic-messages']

    const zh = {
      title: '配置',
      duplicateName: '配置名称不可重复。',
      countSuffix: '条配置',
      add: '添加配置',
      addHint: '同一个 provider 下的多条配置彼此平等：名称即聊天页模型列表的分组名，每条都能改端点、协议、模型，也能删除。',
      namePlaceholder: '配置名称',
      keyPlaceholder: '粘贴 API Key',
      saveKey: '保存 Key',
      clearKey: '清除 Key',
      save: '保存',
      saving: '保存中…',
      saved: '已保存',
      keyConfigured: 'Key 已配置',
      keyMissing: 'Key 未配置',
      advanced: '自定义设置',
      modelId: '模型 ID',
      modelName: '显示名称',
      contextWindow: '上下文窗口',
      maxTokens: '最大输出',
      inputTypes: '输入类型',
      text: '文本',
      image: '图片',
      addModel: '添加模型',
      removeModel: '移除',
      modelsEmpty: '未显式配置模型时继承主配置或 catalog 目录。',
      fetchModels: '一键获取模型',
      fetching: '获取中…',
      fetchEmpty: '该端点没有返回模型。',
      fetchedPrefix: '已获取',
      endpoint: '端点（baseURL）',
      endpointInherit: '留空继承主配置或 catalog 默认',
      protocol: '线协议',
      protocolInherit: '继承主配置/catalog',
      models: '模型 ID',
      modelsHint: '每行一个；留空继承主配置或 catalog 目录。已存在的模型会保留原有元数据。',
      remove: '删除',
      confirmRemove: '确认删除',
      cancel: '取消',
      base: '配置',
      migrate: '迁移旧别名',
      failed: '加载失败',
    }

    const en = {
      title: 'Configurations',
      duplicateName: 'Configuration names must be unique.',
      countSuffix: 'configs',
      add: 'Add configuration',
      addHint: 'Configurations of one provider are peers: the name is the model-list group name in chat, and each one can change its endpoint, protocol, models and be removed.',
      namePlaceholder: 'Configuration name',
      keyPlaceholder: 'Paste API key',
      saveKey: 'Save key',
      clearKey: 'Clear key',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved',
      keyConfigured: 'Key configured',
      keyMissing: 'Key missing',
      advanced: 'Customized settings',
      modelId: 'Model id',
      modelName: 'Display name',
      contextWindow: 'Context window',
      maxTokens: 'Max output',
      inputTypes: 'Input types',
      text: 'Text',
      image: 'Image',
      addModel: 'Add model',
      removeModel: 'Remove',
      modelsEmpty: 'Empty inherits the primary configuration or the catalog.',
      fetchModels: 'Fetch models',
      fetching: 'Fetching…',
      fetchEmpty: 'The endpoint returned no models.',
      fetchedPrefix: 'Fetched',
      endpoint: 'Endpoint (baseURL)',
      endpointInherit: 'Empty inherits the primary configuration or the catalog default',
      protocol: 'Wire protocol',
      protocolInherit: 'Inherit from primary/catalog',
      models: 'Model ids',
      modelsHint: 'One per line; empty inherits the primary configuration or the catalog. Existing models keep their metadata.',
      remove: 'Remove',
      confirmRemove: 'Confirm removal',
      cancel: 'Cancel',
      base: 'Config',
      migrate: 'Migrate legacy aliases',
      failed: 'Failed to load',
    }

    function isRecord(value) {
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    }

    function namespaceOf(namespaces) {
      return (namespaces ?? []).find((candidate) => {
        const ns = String(candidate.ns ?? '')
        return ns === SETTINGS_NS || ns.endsWith(`:${SETTINGS_NS}`) || ns.endsWith(`/${SETTINGS_NS}`)
      })
    }

    function matchesNamespace(ns) {
      return String(ns ?? '').includes(SETTINGS_NS)
    }

    function derivedRef(route) {
      return `${route.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
    }

    function labelOf(route, profile) {
      const name = isRecord(profile) ? profile.displayName : undefined
      return typeof name === 'string' && name.length > 0 ? name : route
    }

    function accountsOf(profile) {
      return isRecord(profile) && Array.isArray(profile.accounts) ? profile.accounts : []
    }

    function legacyAliases(providers, baseId) {
      return Object.entries(providers).filter(
        ([route, profile]) => route !== baseId && isRecord(profile) && profile.catalog === baseId,
      )
    }

    function baseRefOf(route, profile) {
      const explicit = isRecord(profile) ? profile.apiKeyEnv : undefined
      return typeof explicit === 'string' && explicit.length > 0 ? explicit : derivedRef(route)
    }

    function accountRefOf(baseId, index, account) {
      const explicit = isRecord(account) ? account.apiKeyEnv : undefined
      return typeof explicit === 'string' && explicit.length > 0 ? explicit : derivedRef(`${baseId}_${index + 2}`)
    }

    function usedRefs(providers) {
      const refs = new Set()
      for (const [route, profile] of Object.entries(providers)) {
        if (!isRecord(profile)) continue
        refs.add(baseRefOf(route, profile))
        accountsOf(profile).forEach((account, index) => refs.add(accountRefOf(route, index, account)))
      }
      return refs
    }

    function nextAccountRef(baseId, providers) {
      const used = usedRefs(providers)
      let index = 2
      while (used.has(derivedRef(`${baseId}_${index}`))) index += 1
      return derivedRef(`${baseId}_${index}`)
    }

    function modelsOf(models) {
      if (!Array.isArray(models)) return []
      return models.filter(isRecord).map((model) => ({
        id: typeof model.id === 'string' ? model.id : '',
        name: typeof model.name === 'string' ? model.name : '',
        contextWindow: typeof model.contextWindow === 'number' ? model.contextWindow : undefined,
        maxTokens: typeof model.maxTokens === 'number' ? model.maxTokens : undefined,
        input: Array.isArray(model.input) ? [...model.input] : [],
        reasoningEfforts: model.reasoningEfforts,
        compat: model.compat,
      }))
    }

    function modelsFromList(list) {
      const rows = list
        .map((model) => ({ ...model, id: String(model.id ?? '').trim() }))
        .filter((model) => model.id.length > 0)
      if (rows.length === 0) return undefined
      return rows.map((model) => {
        const out = { id: model.id }
        if (model.name.length > 0) out.name = model.name
        if (Number.isFinite(model.contextWindow) && model.contextWindow > 0) out.contextWindow = model.contextWindow
        if (Number.isFinite(model.maxTokens) && model.maxTokens > 0) out.maxTokens = model.maxTokens
        if (Array.isArray(model.input) && model.input.length > 0) out.input = model.input
        if (model.reasoningEfforts !== undefined) out.reasoningEfforts = model.reasoningEfforts
        if (model.compat !== undefined) out.compat = model.compat
        return out
      })
    }

    function numberOrUndefined(value) {
      if (value === '') return undefined
      const parsed = Number(value)
      return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined
    }

    function modelsKey(models) {
      return JSON.stringify(
        (Array.isArray(models) ? models : []).map((model) => [model.id, model.name, model.contextWindow, model.maxTokens, model.input]),
      )
    }

    const INITIAL_STATE = {
      status: 'idle',
      error: '',
      notice: '',
      revision: 0,
      namespace: SETTINGS_NS,
      providers: {},
      credentials: {},
      writable: true,
      busy: false,
    }

    const EMPTY_STATE = { ...INITIAL_STATE, writable: false, busy: true }

    function fieldOp(route, key, value) {
      const empty = value === undefined || value === null || value === ''
      return empty
        ? { op: 'unset', path: ['providers', route, key] }
        : { op: 'set', path: ['providers', route, key], value }
    }

    function createStore(ctx) {
      let state = INITIAL_STATE
      const listeners = new Set()
      const emit = () => {
        for (const listener of [...listeners]) listener()
      }
      const set = (patch) => {
        state = { ...state, ...patch }
        emit()
      }

      let inFlight
      async function load() {
        if (inFlight !== undefined) return inFlight
        inFlight = (async () => {
          try {
            const described = await ctx.remote.settings.describe()
            if (!described.ok) throw new Error(described.error?.message ?? 'settings describe failed')
            const view = namespaceOf(described.value.namespaces)
            if (view === undefined) throw new Error(`settings namespace "${SETTINGS_NS}" is not served`)
            const providers = isRecord(view.value?.providers) ? view.value.providers : {}
            const refs = [...usedRefs(providers)]
            const credentials = {}
            if (refs.length > 0) {
              const response = await ctx.remote.credentials.describe(refs)
              if (response.ok) Object.assign(credentials, response.value)
            }
            set({
              status: 'ready',
              error: '',
              revision: view.revision,
              namespace: view.ns,
              providers,
              credentials,
              writable: described.value.writable !== false,
            })
          } catch (error) {
            set({ status: 'error', error: String(error?.message ?? error) })
          } finally {
            inFlight = undefined
          }
        })()
        return inFlight
      }

      async function write(ops) {
        set({ busy: true, notice: '' })
        try {
          const response = await ctx.remote.settings.mutate(state.namespace ?? SETTINGS_NS, ops, state.revision)
          if (!response.ok) {
            await load()
            return { ok: false, message: response.error?.message ?? response.error?.code ?? 'write refused' }
          }
          await load()
          set({ notice: 'saved' })
          return { ok: true }
        } catch (error) {
          await load().catch(() => {})
          return { ok: false, message: String(error?.message ?? error) }
        } finally {
          set({ busy: false })
        }
      }

      function setAccounts(route, accounts) {
        return write([
          accounts.length === 0
            ? { op: 'unset', path: ['providers', route, 'accounts'] }
            : { op: 'set', path: ['providers', route, 'accounts'], value: accounts },
        ])
      }

      function accountPatch(baseId, accountIndex, patch) {
        const accounts = accountsOf(state.providers[baseId]).map((account) => ({ ...account }))
        const current = accounts[accountIndex]
        if (current === undefined) return { ok: false, message: 'account missing' }
        const next = { ...current }
        if (patch.displayName !== undefined) next.name = patch.displayName.length > 0 ? patch.displayName : current.name
        for (const key of ['baseURL', 'api']) {
          if (patch[key] === undefined) continue
          if (patch[key].length === 0) delete next[key]
          else next[key] = patch[key]
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'models')) {
          if (patch.models === undefined) delete next.models
          else next.models = patch.models
        }
        accounts[accountIndex] = next
        return setAccounts(baseId, accounts)
      }

      return {
        subscribe: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        getSnapshot: () => state,
        load,
        async discover(request) {
          try {
            const response = await ctx.remote.llm.discoverModels(state.namespace ?? SETTINGS_NS, request)
            if (!response.ok) return { ok: false, message: response.error?.message ?? 'model discovery refused' }
            return { ok: true, models: response.value }
          } catch (error) {
            return { ok: false, message: String(error?.message ?? error) }
          }
        },
        async saveConfig(baseId, index, patch) {
          return accountPatch(baseId, index, patch)
        },
        async addConfig(baseId, labelArg) {
          const profile = state.providers[baseId]
          const accounts = accountsOf(profile).map((account) => ({ ...account }))
          const usedNames = new Set(accounts.map((account) => String(account.name ?? '').trim()))
          const label = typeof labelArg === 'string' && labelArg.length > 0 ? labelArg : labelOf(baseId, profile)
          let index = accounts.length + 1
          while (usedNames.has(`${label} · ${index}`)) index += 1
          const seedRef =
            typeof profile?.apiKeyEnv === 'string' &&
            profile.apiKeyEnv.length > 0 &&
            !accounts.some((account) => account.apiKeyEnv === profile.apiKeyEnv)
              ? profile.apiKeyEnv
              : undefined
          accounts.push({
            name: `${label} · ${index}`,
            apiKeyEnv: seedRef ?? nextAccountRef(baseId, state.providers),
          })
          return setAccounts(baseId, accounts)
        },
        async removeConfig(baseId, index) {
          const profile = state.providers[baseId]
          const accounts = accountsOf(profile)
            .filter((_, position) => position !== index)
            .map((account) => ({ ...account }))
          if (accounts.length === 0) return write([{ op: 'unset', path: ['providers', baseId] }])
          return setAccounts(baseId, accounts)
        },
        async saveKey(route, ref, value) {
          try {
            const response = await ctx.remote.credentials.set(ref, value)
            if (!response.ok) return { ok: false, message: response.error?.message ?? 'credential write refused' }
            await load()
            set({ notice: 'saved' })
            return { ok: true }
          } catch (error) {
            return { ok: false, message: String(error?.message ?? error) }
          }
        },
        async clearKey(ref) {
          try {
            const response = await ctx.remote.credentials.unset(ref)
            if (!response.ok) return { ok: false, message: response.error?.message ?? 'credential clear refused' }
            await load()
            set({ notice: 'saved' })
            return { ok: true }
          } catch (error) {
            return { ok: false, message: String(error?.message ?? error) }
          }
        },
        async migrateLegacy(route) {
          const legacy = legacyAliases(state.providers, route)
          if (legacy.length === 0) return { ok: true }
          if (!isRecord(state.providers[route])) return { ok: false, message: 'primary configuration missing' }
          const accounts = accountsOf(state.providers[route]).map((account) => ({ ...account }))
          const ops = []
          for (const [legacyRoute, profile] of legacy) {
            const account = { name: labelOf(legacyRoute, profile), apiKeyEnv: baseRefOf(legacyRoute, profile) }
            if (profile.baseURL !== undefined) account.baseURL = profile.baseURL
            if (profile.api !== undefined) account.api = profile.api
            if (profile.models !== undefined) account.models = profile.models
            accounts.push(account)
            ops.push({ op: 'unset', path: ['providers', legacyRoute] })
          }
          ops.unshift({ op: 'set', path: ['providers', route, 'accounts'], value: accounts })
          return write(ops)
        },
      }
    }

    const CSS = `
.mpc_panel{display:flex;flex-direction:column;gap:8px;margin-top:14px;padding-top:12px;border-top:.5px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-l1))}
.mpc_head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.mpc_title{margin:0;font-size:13px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary)}
.mpc_count{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.mpc_rows{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.mpc_row{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border:.5px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l2));border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-1))}
.mpc_rowHead{display:flex;align-items:center;gap:8px;min-width:0;width:100%;padding:0;border:0;background:0 0;font:inherit;color:inherit;text-align:left;cursor:pointer}
.mpc_rowName{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;line-height:22px;color:var(--dsw-alias-label-primary)}
.mpc_rowNameEmpty{color:var(--dsw-alias-label-tertiary);font-weight:400}
.mpc_chev{flex:none;width:6px;height:6px;margin:0 2px 0 6px;border-right:1.5px solid var(--dsw-alias-label-tertiary);border-bottom:1.5px solid var(--dsw-alias-label-tertiary);transform:rotate(-45deg);transition:transform .12s}
.mpc_rowHead[aria-expanded="true"] .mpc_chev{transform:rotate(45deg)}
.mpc_body{display:flex;flex-direction:column;gap:8px}
.mpc_bodyHidden{display:none}
.mpc_addFull{width:100%;justify-content:center;gap:6px;border-style:dashed;color:var(--dsw-alias-label-secondary)}
.mpc_plus{font-size:16px;line-height:1}
.mpc_dot{width:8px;height:8px;border-radius:50%;flex:none}
.mpc_dotOk{background:var(--dsw-alias-state-success-primary)}
.mpc_dotMissing{background:var(--dsw-alias-state-error-primary)}
.mpc_name{flex:1 1 auto;min-width:0;box-sizing:border-box;font:inherit;font-size:14px;font-weight:500;line-height:22px;color:var(--dsw-alias-label-primary);background:0 0;border:.5px solid transparent;border-radius:var(--dsw-radius-sm,6px);margin-left:-6px;padding:2px 6px}
.mpc_name:hover:not(:disabled){border-color:var(--dsw-alias-border-l3,var(--dsw-alias-border-l2))}
.mpc_name:focus{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));outline:none}
.mpc_chip{flex:none;white-space:nowrap;box-sizing:border-box;padding:1px 6px;border:.5px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));border-radius:var(--dsw-radius-xs,4px);font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}
.mpc_mono{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:11px}
.mpc_meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.mpc_keyRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mpc_input{box-sizing:border-box;flex:1 1 200px;min-width:0;height:32px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l4,var(--dsw-alias-border-l3));border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px}
.mpc_input:focus{outline:none;border-color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary))}
.mpc_input:disabled{opacity:.6}
.mpc_textarea{box-sizing:border-box;width:100%;min-height:72px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l4,var(--dsw-alias-border-l3));border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;resize:vertical}
.mpc_textarea:focus{outline:none;border-color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary))}
.mpc_select{box-sizing:border-box;height:32px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}
.mpc_select:focus{outline:none;border-color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary))}
.mpc_field{display:flex;flex-direction:column;gap:6px}
.mpc_label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.mpc_button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;height:32px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));border-radius:var(--dsw-radius-md,8px);background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;white-space:nowrap;cursor:pointer}
.mpc_button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}
.mpc_button:disabled{opacity:.45;cursor:default}
.mpc_button:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}
.mpc_primary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}
.mpc_danger{color:var(--dsw-alias-state-error-primary)}
.mpc_actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mpc_spacer{flex:1 1 auto}
.mpc_add{align-self:flex-start}
.mpc_hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.mpc_error{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary);word-break:break-word}
.mpc_notice{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-success-primary)}
.mpc_fold{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;background:0 0;border:0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;font-weight:500;line-height:18px;padding:2px 0;cursor:pointer}
.mpc_fold:disabled{opacity:.45;cursor:default}
.mpc_fold:before{content:"";display:inline-block;width:5px;height:5px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);transition:transform .12s}
.mpc_fold[aria-expanded="true"]:before{transform:rotate(45deg)}
.mpc_customized{display:flex;flex-direction:column;gap:12px;padding:12px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-layer-1)}
.mpc_grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px}
.mpc_models{display:flex;flex-direction:column;gap:10px}
.mpc_model{display:flex;flex-direction:column;gap:8px;padding:10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px)}
.mpc_modelHead{display:flex;align-items:center;gap:8px}
.mpc_checks{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--dsw-alias-label-secondary)}
.mpc_check{display:inline-flex;align-items:center;gap:6px}
.mpc_customized .mpc_input,.mpc_customized .mpc_select{flex:none;width:100%;height:28px;padding:0 8px;font-size:12px;line-height:18px;box-sizing:border-box}
.mpc_customized .mpc_button{height:28px;padding:0 10px;font-size:12px;line-height:18px}
.mpc_customized .mpc_label{font-size:12px}
.mpc_model .mpc_input{flex:none;width:100%}
.mpc_modelHead .mpc_input{flex:1 1 auto;min-width:0}
.mpc_modelsHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
`

    function ConfigRow({ t, manager, route, index, config, base, disabled, otherNames, expanded, onToggle, onNotice }) {
      const [name, setName] = React.useState(config.name)
      const [keyDraft, setKeyDraft] = React.useState('')
      const [baseURL, setBaseURL] = React.useState(config.baseURL ?? '')
      const [api, setApi] = React.useState(config.api ?? '')
      const [models, setModels] = React.useState(modelsOf(config.models))
      const [open, setOpen] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [fetching, setFetching] = React.useState(false)
      const [fetched, setFetched] = React.useState(0)
      const [error, setError] = React.useState('')
      const [confirming, setConfirming] = React.useState(false)

      React.useEffect(() => {
        setName(config.name)
        setBaseURL(config.baseURL ?? '')
        setApi(config.api ?? '')
        setModels(modelsOf(config.models))
      }, [config.name, config.baseURL, config.api, config.keyRef, modelsKey(config.models)])

      const configured = config.credential?.configured === true
      const locked = disabled || busy

      const save = async () => {
        if (locked) return
        const trimmed = name.trim()
        if (trimmed.length > 0 && (otherNames ?? []).some((other) => other === trimmed)) {
          setError(t('duplicateName'))
          return
        }
        setBusy(true)
        setError('')
        const patch = {
          displayName: name.trim(),
          baseURL: baseURL.trim(),
          api,
          models: modelsFromList(models),
        }
        const result = await manager.saveConfig(route, index, patch)
        if (!result.ok) {
          setBusy(false)
          setError(result.message)
          return
        }
        const key = keyDraft.trim()
        if (key.length > 0) {
          const saved = await manager.saveKey(route, config.keyRef, key, base)
          if (!saved.ok) {
            setBusy(false)
            setError(saved.message)
            return
          }
          setKeyDraft('')
        }
        setBusy(false)
        onNotice()
      }

      const saveKey = async () => {
        const value = keyDraft.trim()
        if (locked || value.length === 0) return
        setBusy(true)
        setError('')
        const result = await manager.saveKey(route, config.keyRef, value, base)
        setBusy(false)
        if (!result.ok) setError(result.message)
        else {
          setKeyDraft('')
          onNotice()
        }
      }

      const clearKey = async () => {
        if (locked) return
        setBusy(true)
        setError('')
        const result = await manager.clearKey(config.keyRef)
        setBusy(false)
        if (!result.ok) setError(result.message)
        else onNotice()
      }

      const remove = async () => {
        if (!confirming) {
          setConfirming(true)
          return
        }
        setBusy(true)
        setError('')
        const result = await manager.removeConfig(route, index)
        setBusy(false)
        if (!result.ok) {
          setConfirming(false)
          setError(result.message)
        }
      }

      const fetchModels = async () => {
        if (locked) return
        setFetching(true)
        setError('')
        setFetched(0)
        const endpoint = baseURL.trim()
        const request = {}
        if (endpoint.length === 0) request.provider = route
        else {
          request.baseURL = endpoint
          request.api = api || 'openai-completions'
        }
        const key = keyDraft.trim()
        if (key.length > 0) request.apiKey = key
        const result = await manager.discover(request)
        setFetching(false)
        if (!result.ok) {
          setError(result.message)
          return
        }
        const found = Array.isArray(result.models) ? result.models : []
        if (found.length === 0) {
          setError(t('fetchEmpty'))
          return
        }
        setModels(
          found.map((model) => ({
            id: String(model.id ?? ''),
            name: typeof model.name === 'string' ? model.name : '',
            contextWindow: typeof model.contextWindow === 'number' ? model.contextWindow : undefined,
            maxTokens: typeof model.maxTokens === 'number' ? model.maxTokens : undefined,
            input: Array.isArray(model.inputModalities) && model.inputModalities.length > 0 ? [...model.inputModalities] : ['text'],
          })),
        )
        setFetched(found.length)
        onNotice()
      }

      const updateModel = (index, patch) => {
        setModels((list) => list.map((model, position) => (position === index ? { ...model, ...patch } : model)))
      }
      const removeModel = (index) => {
        setModels((list) => list.filter((_, position) => position !== index))
      }
      const toggleInput = (index, modality, enabled) => {
        setModels((list) =>
          list.map((model, position) => {
            if (position !== index) return model
            const input = new Set(model.input)
            if (enabled) input.add(modality)
            else input.delete(modality)
            return { ...model, input: [...input] }
          }),
        )
      }

      return h(
        'li',
        { className: 'mpc_row' },
        h(
          'div',
          {
            className: 'mpc_rowHead',
            role: 'button',
            tabIndex: 0,
            'aria-expanded': expanded,
            onClick: onToggle,
            onKeyDown: (event) => {
              if (event.target !== event.currentTarget) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onToggle()
              }
            },
          },
          h('span', {
            className: `mpc_dot ${configured ? 'mpc_dotOk' : 'mpc_dotMissing'}`,
            title: configured ? t('keyConfigured') : t('keyMissing'),
          }),
          expanded
            ? h('input', {
                className: 'mpc_name',
                value: name,
                disabled: locked,
                spellCheck: false,
                'aria-label': t('namePlaceholder'),
                onClick: (event) => event.stopPropagation(),
                onKeyDown: (event) => event.stopPropagation(),
                onChange: (event) => setName(event.target.value),
              })
            : h(
                'span',
                { className: `mpc_rowName${name.length === 0 ? ' mpc_rowNameEmpty' : ''}` },
                name.length > 0 ? name : config.keyRef,
              ),
          h('span', { className: 'mpc_chip' }, `${t('base')} ${index + 1}`),
          h('span', { className: 'mpc_chev', 'aria-hidden': true }),
        ),
        h(
          'div',
          { className: expanded ? 'mpc_body' : 'mpc_body mpc_bodyHidden' },
        h(
          'div',
          { className: 'mpc_meta' },
          h('span', {}, configured ? t('keyConfigured') : t('keyMissing')),
        ),
        h(
          'div',
          { className: 'mpc_keyRow' },
          h('input', {
            className: 'mpc_input',
            type: 'password',
            autoComplete: 'new-password',
            spellCheck: false,
            placeholder: t('keyPlaceholder'),
            value: keyDraft,
            disabled: locked,
            'aria-label': `${t('keyPlaceholder')} — ${config.name}`,
            onChange: (event) => setKeyDraft(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                saveKey()
              }
            },
          }),
          h('button', { type: 'button', className: 'mpc_button', disabled: locked || keyDraft.trim().length === 0, onClick: saveKey }, t('saveKey')),
          configured ? h('button', { type: 'button', className: 'mpc_button', disabled: locked, onClick: clearKey }, t('clearKey')) : null,
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mpc_fold',
            disabled: locked,
            onClick: () => setOpen((value) => !value),
            'aria-expanded': open,
          },
          t('advanced'),
        ),
        open
          ? h(
              'div',
              { className: 'mpc_customized' },
              h(
                'div',
                { className: 'mpc_field' },
                h('label', { className: 'mpc_label' }, t('endpoint')),
                h('input', {
                  className: 'mpc_input',
                  value: baseURL,
                  disabled: locked,
                  spellCheck: false,
                  placeholder: t('endpointInherit'),
                  onChange: (event) => setBaseURL(event.target.value),
                }),
              ),
              h(
                'div',
                { className: 'mpc_field' },
                h('label', { className: 'mpc_label' }, t('protocol')),
                h(
                  'select',
                  {
                    className: 'mpc_select',
                    value: api,
                    disabled: locked,
                    onChange: (event) => setApi(event.target.value),
                  },
                  PROTOCOLS.map((option) =>
                    h('option', { key: option || 'inherit', value: option }, option || t('protocolInherit')),
                  ),
                ),
              ),
              h(
                'div',
                { className: 'mpc_field' },
                h(
                  'div',
                  { className: 'mpc_modelsHead' },
                  h('label', { className: 'mpc_label' }, t('models')),
                  h(
                    'button',
                    { type: 'button', className: 'mpc_button', disabled: locked || fetching, onClick: fetchModels },
                    fetching ? t('fetching') : t('fetchModels'),
                  ),
                  fetched > 0 ? h('span', { className: 'mpc_hint' }, `${t('fetchedPrefix')} ${fetched}`) : null,
                ),
                models.length === 0 ? h('p', { className: 'mpc_hint' }, t('modelsEmpty')) : null,
                h(
                  'div',
                  { className: 'mpc_models' },
                  models.map((model, index) =>
                    h(
                      'div',
                      { className: 'mpc_model', key: index },
                      h(
                        'div',
                        { className: 'mpc_modelHead' },
                        h('input', {
                          className: 'mpc_input mpc_mono',
                          value: model.id,
                          disabled: locked,
                          spellCheck: false,
                          placeholder: t('modelId'),
                          onChange: (event) => updateModel(index, { id: event.target.value }),
                        }),
                        h(
                          'button',
                          { type: 'button', className: 'mpc_button mpc_danger', disabled: locked, onClick: () => removeModel(index) },
                          t('removeModel'),
                        ),
                      ),
                      h('input', {
                        className: 'mpc_input',
                        value: model.name,
                        disabled: locked,
                        spellCheck: false,
                        placeholder: t('modelName'),
                        onChange: (event) => updateModel(index, { name: event.target.value }),
                      }),
                      h(
                        'div',
                        { className: 'mpc_grid' },
                        h(
                          'label',
                          { className: 'mpc_field' },
                          h('span', { className: 'mpc_label' }, t('contextWindow')),
                          h('input', {
                            className: 'mpc_input',
                            type: 'number',
                            min: 1,
                            value: model.contextWindow ?? '',
                            disabled: locked,
                            onChange: (event) => updateModel(index, { contextWindow: numberOrUndefined(event.target.value) }),
                          }),
                        ),
                        h(
                          'label',
                          { className: 'mpc_field' },
                          h('span', { className: 'mpc_label' }, t('maxTokens')),
                          h('input', {
                            className: 'mpc_input',
                            type: 'number',
                            min: 1,
                            value: model.maxTokens ?? '',
                            disabled: locked,
                            onChange: (event) => updateModel(index, { maxTokens: numberOrUndefined(event.target.value) }),
                          }),
                        ),
                      ),
                      h(
                        'div',
                        { className: 'mpc_checks' },
                        h('span', { className: 'mpc_label' }, t('inputTypes')),
                        h(
                          'label',
                          { className: 'mpc_check' },
                          h('input', {
                            type: 'checkbox',
                            checked: model.input.includes('text'),
                            disabled: locked,
                            onChange: (event) => toggleInput(index, 'text', event.target.checked),
                          }),
                          t('text'),
                        ),
                        h(
                          'label',
                          { className: 'mpc_check' },
                          h('input', {
                            type: 'checkbox',
                            checked: model.input.includes('image'),
                            disabled: locked,
                            onChange: (event) => toggleInput(index, 'image', event.target.checked),
                          }),
                          t('image'),
                        ),
                      ),
                    ),
                  ),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mpc_button',
                    style: { alignSelf: 'flex-start' },
                    disabled: locked,
                    onClick: () => setModels([...models, { id: '', name: '', input: ['text'] }]),
                  },
                  t('addModel'),
                ),
                h('p', { className: 'mpc_hint' }, t('modelsHint')),
              ),
            )
          : null,
        h(
          'div',
          { className: 'mpc_actions' },
          h('button', { type: 'button', className: 'mpc_button mpc_primary', disabled: locked, onClick: save }, busy ? t('saving') : t('save')),
          h('span', { className: 'mpc_spacer' }),
          h(
            'button',
            { type: 'button', className: 'mpc_button mpc_danger', disabled: locked, onClick: remove },
            confirming ? t('confirmRemove') : t('remove'),
          ),
          confirming
            ? h('button', { type: 'button', className: 'mpc_button', disabled: locked, onClick: () => setConfirming(false) }, t('cancel'))
            : null,
        ),
        ),
        error.length > 0 ? h('p', { className: 'mpc_error', role: 'alert' }, error) : null,
      )
    }

    function ConfigsPanel(props) {
      const manager = props.manager
      const entry = props.provider
      const state = React.useSyncExternalStore(
        manager !== undefined ? manager.subscribe : () => () => {},
        manager !== undefined ? manager.getSnapshot : () => EMPTY_STATE,
      )
      const [error, setError] = React.useState('')
      const [expandedIndex, setExpandedIndex] = React.useState(null)
      const panelRef = React.useRef(null)
      React.useEffect(() => {
        manager?.load?.()
      }, [manager])

      const baseId =
        entry === undefined
          ? undefined
          : (entry.provider ?? entry.id ?? (Array.isArray(entry.settingsPath) ? entry.settingsPath[1] : undefined))

      // A provider whose card owns several configurations manages them here, so
      // the page's own per-provider editor button would only duplicate row 1.
      React.useEffect(() => {
        if (typeof baseId !== 'string' || baseId.length === 0) return undefined
        const profile = state.providers[baseId]
        if (!isRecord(profile) || accountsOf(profile).length === 0) return undefined
        const card = panelRef.current?.closest('li')
        const actions = card?.querySelector('[class*="_rowActions"]')
        const button = actions?.querySelector('button')
        if (!button) return undefined
        const previous = button.style.display
        button.style.display = 'none'
        return () => {
          button.style.display = previous
        }
      }, [state.providers, baseId])

      if (manager === undefined || entry === undefined || !matchesNamespace(entry.settingsNs ?? entry.ns)) return null
      if (entry.declared === true) return null
      if (typeof baseId !== 'string' || baseId.length === 0) return null

      const profile = state.providers[baseId]
      if (!isRecord(profile)) {
        if (state.status === 'error') {
          return h('p', { className: 'mpc_error', role: 'alert' }, `配置读取失败：${state.error}`)
        }
        if (props.configured === true) {
          return h(
            'p',
            { className: 'mpc_error', role: 'status' },
            `配置读取异常：provider=${String(baseId)} status=${state.status}${state.error.length > 0 ? ` error=${state.error}` : ''}`,
          )
        }
        return null
      }

      const accounts = accountsOf(profile)
      const legacy = legacyAliases(state.providers, baseId)
      const t = props.t ?? ((key) => key)
      const disabled = state.busy || !state.writable
      const total = accounts.length

      const rows = accounts.map((account, offset) => {
        const ref = accountRefOf(baseId, offset, account)
        return {
          key: `${baseId}:${offset}`,
          index: offset,
          config: {
            name: typeof account.name === 'string' && account.name.length > 0 ? account.name : `${labelOf(baseId, profile)} · ${offset + 1}`,
            keyRef: ref,
            baseURL: typeof account.baseURL === 'string' ? account.baseURL : undefined,
            api: typeof account.api === 'string' ? account.api : undefined,
            models: Array.isArray(account.models) ? account.models : undefined,
            credential: state.credentials[ref],
          },
        }
      })

      const nameList = rows.map((row) => row.config.name.trim())

      const add = async () => {
        setError('')
        const createdIndex = accounts.length
        const result = await manager.addConfig(baseId, entry.displayName)
        if (!result.ok) setError(result.message)
        else setExpandedIndex(createdIndex)
      }
      const migrate = async () => {
        setError('')
        const result = await manager.migrateLegacy(baseId)
        if (!result.ok) setError(result.message)
      }

      return h(
        'div',
        { className: 'mpc_panel', ref: panelRef },
        h(
          'div',
          { className: 'mpc_head' },
          h('h4', { className: 'mpc_title' }, t('title')),
          h('span', { className: 'mpc_count' }, `${total} ${t('countSuffix')}`),
        ),
        state.status === 'error' ? h('p', { className: 'mpc_error', role: 'alert' }, `${t('failed')}: ${state.error}`) : null,
        h(
          'ul',
          { className: 'mpc_rows' },
          rows.map((row, position) =>
            h(ConfigRow, {
              key: row.key,
              t,
              manager,
              route: baseId,
              index: row.index,
              config: row.config,
              base: row.base,
              disabled,
              expanded: expandedIndex === row.index,
              onToggle: () => setExpandedIndex((current) => (current === row.index ? null : row.index)),
              otherNames: nameList.filter((_, index) => index !== position),
              onNotice: () => setError(''),
            }),
          ),
        ),
        h(
          'button',
          { type: 'button', className: 'mpc_button mpc_addFull', disabled, onClick: add },
          h('span', { className: 'mpc_plus', 'aria-hidden': true }, '+'),
          h('span', {}, t('add')),
        ),
        legacy.length > 0
          ? h('button', { type: 'button', className: 'mpc_button mpc_add', disabled, onClick: migrate }, `${t('migrate')} (${legacy.length})`)
          : null,
        h('p', { className: 'mpc_hint' }, t('addHint')),
        state.notice === 'saved' ? h('p', { className: 'mpc_notice' }, t('saved')) : null,
        error.length > 0 ? h('p', { className: 'mpc_error', role: 'alert' }, error) : null,
      )
    }

    class PanelBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { message: '' }
      }

      static getDerivedStateFromError(error) {
        return { message: String((error && error.message) || error) }
      }

      render() {
        if (this.state.message.length > 0) {
          return h('p', { className: 'mpc_error', role: 'alert' }, `配置面板错误：${this.state.message}`)
        }
        return this.props.children
      }
    }

    function Panel(props) {
      return h(PanelBoundary, null, h(ConfigsPanel, props))
    }

    function apply(ctx) {
      const store = createStore(ctx)
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'provider-configs: dictionaries')
      ctx.effect(() => {
        const style = document.createElement('style')
        style.dataset.plugin = NS
        style.textContent = CSS
        document.head.append(style)
        return () => style.remove()
      }, 'provider-configs: styles')
      ctx.effect(() => {
        const disposers = [
          ctx.remote.$on('settings/document-updated', () => store.load()),
          ctx.remote.$on('credentials/reference-updated', () => store.load()),
          ctx.remote.$on('llm/adapters-updated', () => store.load()),
        ]
        const reset = ctx.on('connection/reset', () => store.load())
        return () => {
          for (const dispose of disposers) dispose()
          reset()
        }
      }, 'provider-configs: invalidations')
      ctx.slots.inject('settings.models.provider-card', () =>
        ['llm-pi-ai', 'include:llm-pi-ai'].map((key) =>
          ctx.slots.register(
            {
              name: 'settings.models.provider-card',
              key,
              locale: NS,
              inject: () => ({ manager: store }),
            },
            Panel,
          ),
        ),
      )
    }

    return { inject: ['slots', 'locale', 'remote', 'remote.settings', 'remote.credentials', 'remote.llm'], apply }
  },
})
