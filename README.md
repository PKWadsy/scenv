# scenv

**Where did that config come from?** Env vars? A file? Something you typed last time? Scenv sorts it out. ✨

Scenv is a small **library** that gives you one clear way to define “this app needs an API URL, a port, a feature flag…” and then figures out the value at runtime: from CLI overrides, environment variables, **context files** (think per-environment or per-run JSON), or a default. You don’t bake “always use env” or “never prompt” into each variable—you control that with config (file, env, or whatever your app passes in). So the same codebase can be strict in CI, interactive in dev, and override-friendly from the command line.

No CLI binary—your app stays in charge. You call `configure()` (e.g. with parsed CLI flags), define variables with `scenv()`, and use `.get()` or `.safeGet()`. Optionally plug in [Zod](packages/scenv-zod) for validation and [Inquirer](packages/scenv-inquirer) for prompts. One API, many sources—no more “is this from .env or a flag?” detective work.

---

## Quick start

```bash
pnpm add scenv
# optional: pnpm add scenv-zod zod  # for validation
# optional: pnpm add scenv-inquirer inquirer  # for interactive prompts
```

```ts
import { configure, parseScenvArgs, scenv } from "scenv";

// Optional: apply CLI flags (--set, --context, --prompt, etc.)
configure(parseScenvArgs(process.argv.slice(2)));

const api_url = scenv("API URL", {
  key: "api_url",
  env: "API_URL",
  default: "http://localhost:4000",
});

const url = await api_url.get();        // throws if missing or invalid
const result = await api_url.safeGet(); // returns { success, value? } | { success: false, error? }
await api_url.save();                   // write current value to a context file
```

---

## Concepts

| Concept | Description |
|--------|-------------|
| **Variable** | Created with `scenv(name, options)`. Has a display name, optional `key` (for env/context), optional `default`, optional `validator` and `prompt` function. |
| **Resolution** | When you call `.get()` or `.safeGet()`, the value is resolved in order: **set overrides** → **environment** → **context files** → **default**. |
| **Config** | Where to load contexts from, when to prompt, whether to ignore env/context, where to save. Comes from **file** (`scenv.config.json`), **environment** (`SCENV_*`), and **programmatic** (`configure()`). |
| **Context** | A JSON file `{name}.context.json` under your project. Contexts are merged in a defined order; later context overwrites earlier for the same key. |

---

## Documentation

| Document | Contents |
|----------|----------|
| [**Configuration**](docs/CONFIGURATION.md) | Config file, `SCENV_*` env vars, programmatic config, precedence. |
| [**Contexts**](docs/CONTEXTS.md) | Context files, discovery, merge order, `--context` / `--add-context`. |
| [**Resolution**](docs/RESOLUTION.md) | Resolution order, prompt modes (`always` / `never` / `fallback` / `no-env`), validation. |
| [**Saving**](docs/SAVING.md) | `variable.save()`, `savePrompt`, `saveContextTo`, callbacks. |
| [**API reference**](docs/API.md) | `scenv()`, `configure`, `loadConfig`, `parseScenvArgs`, types. |
| [**Integration**](docs/INTEGRATION.md) | CLI integration, scenv-zod, scenv-inquirer. |

---

## Resolution order

Values are chosen in this order (first match wins):

1. **Set overrides** – `config.set[key]` (e.g. from `--set key=value`).
2. **Environment** – `process.env[envKey]` (unless `ignoreEnv`).
3. **Context** – Merged values from context files (unless `ignoreContext`), in context order.
4. **Default** – Variable’s `default` option.

Prompting (when to ask the user) is controlled by config `prompt`: `always` | `never` | `fallback` | `no-env`.

---

## Packages

| Package | Purpose |
|--------|--------|
| **scenv** | Core: config, context discovery, variables, `get` / `safeGet` / `save`. |
| **scenv-zod** | `validator(zodSchema)` for type-safe validation and coercion. |
| **scenv-inquirer** | `prompt()` for the variable `prompt` option (great for interactive dev). |

---

## Examples

See [examples/](examples/README.md) for runnable demos—or jump straight to `examples/full-demo` and run `pnpm start`:

- **basic** – Minimal: default, env, `get` / `safeGet`.
- **full-demo** – The kitchen sink: config file, contexts, resolution, validation, save, CLI. Run `pnpm start` in `examples/full-demo`.
- **contexts** – Context merge order; `--context overlay,base`.
- **with-config-file** – All config from `scenv.config.json`.
- **save-flow** – `save()`, `saveContextTo: "ask"`, callbacks.

---

## License

MIT
