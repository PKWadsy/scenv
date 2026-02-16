# senv

Environment and context variables with runtime-configurable resolution. Senv is a **library**, not a CLI: your app parses CLI flags (or env) and calls `senv.configure()` with the result.

## Creating a variable

```ts
import { senv } from "senv";

const core_server_url = senv("Core Server URL", {
  key: "core_server_url",
  env: "CORE_SERVER_URL",
  default: "localhost:7000",
});

// Throws on validation failure or missing value
const url = await core_server_url.get();

// Never throws; returns { success: true, value } or { success: false, error? }
const result = await core_server_url.safeGet();
if (result.success) console.log(result.value);
```

With validation (e.g. [senv-zod](packages/senv-zod)) and prompting (e.g. [senv-inquirer](packages/senv-inquirer)):

```ts
import { senv } from "senv";
import { validator } from "senv-zod";
import { prompt } from "senv-inquirer";
import { z } from "zod";

const port = senv("Port", {
  validator: validator(z.coerce.number()),
  prompt: prompt(),
  default: 3000,
});

const p = await port.get();
```

## Config: precedence

1. **Programmatic** – `senv.configure({ ... })` (e.g. from your CLI parser)
2. **Environment** – `SENV_*` (e.g. `SENV_PROMPT=always`, `SENV_ADD_CONTEXTS=prod,dev`)
3. **File** – `senv.config.json` (searched upward from cwd)

## Contexts

Load contexts so variables can be resolved from `{name}.context.json` files (searched recursively under cwd):

- **Replace**: `contexts: ["prod"]` or `--context prod` or `SENV_CONTEXT=prod`
- **Merge**: `addContexts: ["dev"]` or `--add-context dev` or `SENV_ADD_CONTEXTS=dev`

Contexts are merged in order; later context overwrites earlier for the same key.

## Variable resolution order

When you call `.get()` or `.safeGet()`:

1. `--set key=value` (or `config.set`)
2. Environment variable (if not `ignoreEnv`)
3. Loaded context (if not `ignoreContext`), in context order
4. Default value

Whether the user is **prompted** is controlled by `prompt`:

- `always` – always prompt
- `never` – never prompt
- `fallback` – prompt only if no value from set/env/context
- `no-env` – prompt only when env var is not set

## Saving

- **`variable.save(value?)`** – Saves to a context. Does not ask “save?”; only may ask **which context** if `saveContextTo` is `"ask"`.
- **After being prompted for a value** – If `savePrompt` is `"ask"`, senv will ask “save the value you just entered for next time?” (when you’ve set `configure({ callbacks: { onAskSaveAfterPrompt, onAskContext } })`).

## Passing CLI flags to senv

Parse argv and configure senv:

```ts
import { configure, parseSenvArgs } from "senv";

configure(parseSenvArgs(process.argv.slice(2)));
```

Supported flags: `--context`, `--add-context`, `--prompt`, `--ignore-env`, `--ignore-context`, `--set key=value`, `--save-prompt`, `--save-context-to`.

## Example senv.config.json

```json
{
  "contexts": ["prod"],
  "prompt": "fallback",
  "savePrompt": "ask",
  "saveContextTo": "ask"
}
```

## Packages

| Package         | Purpose                          |
|----------------|-----------------------------------|
| `senv`         | Core: config, context, variables |
| `senv-zod`     | `validator(zodSchema)` for senv  |
| `senv-inquirer`| `prompt()` for senv’s prompt option |
