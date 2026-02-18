# Configuration

Scenv is configured from three layers, merged with the following **precedence** (highest first):

1. **Programmatic** – `scenv.configure({ ... })` (e.g. from your CLI parser).
2. **Environment** – `SCENV_*` variables.
3. **File** – `scenv.config.json` (found by searching upward from the current working directory or from `config.root`).

Later layers never overwrite earlier ones for the same key; programmatic always wins.

---

## Config file: `scenv.config.json`

Place `scenv.config.json` in your project root (or any directory). Scenv searches upward from `process.cwd()` (or from the configured `root`) until it finds a directory containing `scenv.config.json`; that directory becomes the config root and the context search root unless overridden.

### Supported keys

| Key | Type | Description |
|-----|------|-------------|
| `context` | `string[]` | Replace the context list with this array. Context files are loaded in order; see [Contexts](CONTEXTS.md). |
| `addContext` | `string[]` | Append these context names to the existing list (ignored if `context` is set in the same layer). |
| `prompt` | `"always"` \| `"never"` \| `"fallback"` \| `"no-env"` | When to prompt for a variable value; see [Resolution](RESOLUTION.md#prompt-modes). |
| `ignoreEnv` | `boolean` | If `true`, environment variables are not used during resolution. |
| `ignoreContext` | `boolean` | If `true`, context files are not used during resolution. |
| `set` | `Record<string, string>` | Override values by key. Same effect as `--set key=value`. Values can use context references: `@context` or `@context:key` (see [Resolution](RESOLUTION.md#context-references-contextkey)). |
| `saveContextTo` | `string` | Optional. Path or context name (without `.context.json`) where to save resolved values. If set, all saves go here and this context is used when resolving (before prompting). If unset, values are saved to in-memory only. See [Saving](SAVING.md). |
| `contextDir` | `string` | Directory to save context files to when the context is not already discovered. Relative to root unless absolute. If unset, new context files are saved under root. |
| `root` | `string` | Directory used as root for config and context search (optional). |
| `logLevel` | `"none"` \| `"trace"` \| `"debug"` \| `"info"` \| `"warn"` \| `"error"` | Logging level; default is `none` (no logs). Logs go to stderr. |

### Example

```json
{
  "context": ["dev", "prod"],
  "prompt": "fallback",
  "ignoreEnv": false,
  "saveContextTo": "dev"
}
```

---

## Environment variables: `SCENV_*`

Any of the config keys above can be set via environment variables. The mapping is:

| Env variable | Config key | Notes |
|--------------|------------|--------|
| `SCENV_CONTEXT` | `context` | Comma-separated list. Replaces context list. |
| `SCENV_ADD_CONTEXT` | `addContext` | Comma-separated list. Merged with existing context list. |
| `SCENV_PROMPT` | `prompt` | `always`, `never`, `fallback`, `no-env`. |
| `SCENV_IGNORE_ENV` | `ignoreEnv` | `1`, `true`, or `yes` → true. |
| `SCENV_IGNORE_CONTEXT` | `ignoreContext` | `1`, `true`, or `yes` → true. |
| `SCENV_SAVE_CONTEXT_TO` | `saveContextTo` | Path or context name (without `.context.json`). |
| `SCENV_CONTEXT_DIR` | `contextDir` | Directory path (relative to root or absolute). |
| `SCENV_LOG_LEVEL` | `logLevel` | `none`, `trace`, `debug`, `info`, `warn`, `error`. |

Examples:

```bash
export SCENV_PROMPT=always
export SCENV_ADD_CONTEXT=prod,staging
export SCENV_IGNORE_ENV=1
```

---

## Programmatic config: `configure()`

Call `configure(partial)` to overlay config (and optionally callbacks) that take precedence over env and file. Typical use: parse your CLI and pass the result in.

```ts
import { configure, parseScenvArgs } from "scenv";

configure(parseScenvArgs(process.argv.slice(2)));
```

You can also pass a partial config and callbacks:

```ts
configure({
  context: ["prod"],
  prompt: "never",
  set: { api_url: "https://custom.example.com" },
  saveContextTo: "prod",
  callbacks: {
    defaultPrompt: async (name, defaultValue) => { /* ... */ },
  },
});
```

You can call `configure()` multiple times; each call **merges** (shallow) with the existing programmatic config and callbacks. Later keys overwrite earlier ones for the same property; nested objects (e.g. `set`, `callbacks`) are replaced, not deep-merged. Use `resetConfig()` (mainly for tests) to clear programmatic config and callbacks.

---

## Loading config: `loadConfig()`

`loadConfig(root?)` returns the fully merged config (file ← env ← programmatic). You rarely need to call it directly for variable resolution (scenv does that internally), but it is useful to inspect the effective config or to get `root` and `context` for context discovery.

- **root** – If you pass `loadConfig("/path/to/project")`, that path is used as the starting directory when searching for `scenv.config.json`. The directory that contains `scenv.config.json` (if found) is stored as `config.root`; otherwise `root` (or `process.cwd()`) is used.
- **context** – The final merged context list (replace vs add is resolved; see [Contexts](CONTEXTS.md)).
