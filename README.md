# senv

**Environment and context variables with runtime-configurable resolution.**

Senv is a **library**, not a CLI: your application parses CLI flags (or environment variables) and passes the result into `senv.configure()`. Resolution behavior (where values come from, whether to prompt, whether to save) is controlled at runtime by configuration—not hard-coded per variable.

---

## Quick start

```bash
pnpm add senv
# optional: pnpm add senv-zod zod  # for validation
# optional: pnpm add senv-inquirer inquirer  # for interactive prompts
```

```ts
import { configure, parseSenvArgs, senv } from "senv";

// Optional: apply CLI flags (--set, --context, --prompt, etc.)
configure(parseSenvArgs(process.argv.slice(2)));

const api_url = senv("API URL", {
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
| **Variable** | Created with `senv(name, options)`. Has a display name, optional `key` (for env/context), optional `default`, optional `validator` and `prompt` function. |
| **Resolution** | When you call `.get()` or `.safeGet()`, the value is resolved in order: **set overrides** → **environment** → **context files** → **default**. |
| **Config** | Where to load contexts from, when to prompt, whether to ignore env/context, where to save. Comes from **file** (`senv.config.json`), **environment** (`SENV_*`), and **programmatic** (`configure()`). |
| **Context** | A JSON file `{name}.context.json` under your project. Contexts are merged in a defined order; later context overwrites earlier for the same key. |

---

## Documentation

| Document | Contents |
|----------|----------|
| [**Configuration**](docs/CONFIGURATION.md) | Config file, `SENV_*` env vars, programmatic config, precedence. |
| [**Contexts**](docs/CONTEXTS.md) | Context files, discovery, merge order, `--context` / `--add-context`. |
| [**Resolution**](docs/RESOLUTION.md) | Resolution order, prompt modes (`always` / `never` / `fallback` / `no-env`), validation. |
| [**Saving**](docs/SAVING.md) | `variable.save()`, `savePrompt`, `saveContextTo`, callbacks. |
| [**API reference**](docs/API.md) | `senv()`, `configure`, `loadConfig`, `parseSenvArgs`, types. |
| [**Integration**](docs/INTEGRATION.md) | CLI integration, senv-zod, senv-inquirer. |

---

## Resolution order

1. **Set overrides** – `config.set[key]` (e.g. from `--set key=value`).
2. **Environment** – `process.env[envKey]` (unless `ignoreEnv`).
3. **Context** – Merged values from context files (unless `ignoreContext`), in context order.
4. **Default** – Variable’s `default` option.

Prompting (when to ask the user) is controlled by config `prompt`: `always` | `never` | `fallback` | `no-env`.

---

## Packages

| Package | Purpose |
|--------|--------|
| **senv** | Core: config, context discovery, variables, `get` / `safeGet` / `save`. |
| **senv-zod** | `validator(zodSchema)` for type-safe validation and coercion. |
| **senv-inquirer** | `prompt()` that returns a function for the variable `prompt` option. |

---

## Examples

See [examples/](examples/README.md). Highlights:

- **basic** – Default, env, `get` / `safeGet`.
- **full-demo** – Config file, contexts, resolution, validation, save, CLI (run `pnpm start` in `examples/full-demo`).
- **contexts** – Context merge order; `--context overlay,base`.
- **with-config-file** – All config from `senv.config.json`.
- **save-flow** – `save()`, `saveContextTo: "ask"`, callbacks.

---

## License

MIT
