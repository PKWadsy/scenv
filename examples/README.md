# Scenv examples

See the [main documentation](../README.md) and [docs/](../docs/) for configuration, contexts, resolution, and API.

From the repo root:

```bash
pnpm install
pnpm build
cd examples/<name> && pnpm start
```

## Examples

| Example | What it shows |
|--------|----------------|
| **basic** | Simple variable, default + env, `get()` and `safeGet()`. |
| **with-zod** | Validation with `scenv-zod` and Zod (port number, boolean). |
| **cli-integration** | `parseScenvArgs(process.argv)` + `configure()` so `--set`, `--prompt`, `--context` apply. |
| **full-demo** | Config file, context discovery, merged context values, resolution order, validation, `safeGet()` failure, optional save to context. Multiple npm scripts for different scenarios. |
| **contexts** | Context merge order: `base` then `overlay`; later overwrites earlier. Try `pnpm run start:overlay-first` for `--context overlay,base` (base wins where both set). |
| **with-config-file** | All config from `scenv.config.json` (no programmatic config); env overlays. |
| **save-flow** | `variable.save()`, `saveContextTo: "ask"`, `onAskContext` and `onAskSaveAfterPrompt` callbacks (non-interactive). |

## Full demo (recommended)

```bash
cd examples/full-demo
pnpm start
```

Shows: config (file + CLI), context discovery, merged context map, resolved variables (set > env > context > default), `safeGet()` for a missing value, and optional write to a context file.

**Variants:**

| Command | Effect |
|--------|--------|
| `pnpm start` | Values from context files (dev + prod merge). |
| `pnpm run demo:cli-set` | `--set api_url=...` and `--set port=...` override. |
| `pnpm run demo:env` | `API_URL` and `PORT` env vars override context. |
| `pnpm run demo:contexts` | Explicit `--context dev,prod`. |
| `pnpm run demo:ignore-env` | `--ignore-env` so context wins over env. |
| `pnpm run demo:save` | Writes a value to `my-saves.context.json`. |

## Overrides (any example)

- **Env:** `API_URL=https://prod.example.com pnpm start`
- **CLI:** `pnpm start -- --set api_url=https://custom.com --context prod`
