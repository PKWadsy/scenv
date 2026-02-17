# Integration

## CLI integration

Scenv does not parse `process.argv` itself. Your app should parse CLI arguments and pass the result to `configure()`. Use **`parseScenvArgs()`** for the flags scenv understands:

```ts
import { configure, parseScenvArgs } from "scenv";

// Pass everything after the script name (or your app name).
configure(parseScenvArgs(process.argv.slice(2)));
```

If you use a CLI framework (e.g. yargs, commander), you can map its options to the same config shape and call `configure()` with that object instead of (or in addition to) `parseScenvArgs()`.

---

## scenv-zod

**scenv-zod** provides a validator that uses Zod schemas. Values from set/env/context are strings; use `z.coerce.number()`, `z.coerce.boolean()`, etc., to parse them.

```ts
import { scenv } from "scenv";
import { validator } from "scenv-zod";
import { z } from "zod";

const port = scenv("Port", {
  key: "port",
  env: "PORT",
  default: 3000,
  validator: validator(z.coerce.number().min(1).max(65535)),
});

const debug = scenv("Debug", {
  key: "debug",
  default: false,
  validator: validator(
    z.union([z.boolean(), z.literal("true"), z.literal("false")])
      .transform((v) => v === true || v === "true")
  ),
});
```

Install: `pnpm add scenv scenv-zod zod`.

---

## scenv-inquirer

**scenv-inquirer** provides a `prompt()` that returns a function suitable for the variable `prompt` option. Scenv calls that function with `(name, defaultValue)` when it needs to prompt; you do not pass the name or default yourself.

```ts
import { scenv } from "scenv";
import { prompt } from "scenv-inquirer";

const api_url = scenv("API URL", {
  default: "http://localhost:4000",
  prompt: prompt(),
});
```

You can also set **`callbacks.defaultPrompt`** so that inquirer is used for every variable that doesn’t specify its own `prompt`; the variable’s `prompt` option then overrides the default. Example: `configure({ callbacks: { defaultPrompt: prompt() } })`.

Install: `pnpm add scenv scenv-inquirer inquirer`.

### Using scenv-inquirer for save and context prompts

**`callbacks()`** returns `{ callbacks: { defaultPrompt, onAskSaveAfterPrompt, onAskContext } }` so one call wires inquirer as the default prompt for variables (when they don’t specify their own `prompt`) and for save/context asks:

```ts
import { configure } from "scenv";
import { prompt, callbacks } from "scenv-inquirer";

// Inquirer for variable values (default), save-after-prompt, and ask-context
configure(callbacks());
// Or merge with other config:
configure({ ...yourConfig, ...callbacks() });
```

Variable-level `prompt` overrides `defaultPrompt`. Then `SCENV_SAVE_PROMPT=ask` and `saveContextTo: "ask"` prompt interactively. You can also wire a single callback: `configure({ callbacks: { defaultPrompt: prompt() } })` or use `askSaveAfterPrompt()` / `askContext()`.

---

## Combining config sources

Typical setup:

1. **Default** – `scenv.config.json` in the project with `contexts`, `prompt`, etc.
2. **Environment** – CI or shell sets `SCENV_PROMPT=never`, `SCENV_ADD_CONTEXTS=prod`, etc.
3. **CLI** – App calls `configure(parseScenvArgs(process.argv.slice(2)))` so `--set`, `--context`, and other flags override.

Variable definitions stay the same; only the merged config changes how resolution and saving behave.
