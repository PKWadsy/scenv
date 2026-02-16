# Integration

## CLI integration

Senv does not parse `process.argv` itself. Your app should parse CLI arguments and pass the result to `configure()`. Use **`parseSenvArgs()`** for the flags senv understands:

```ts
import { configure, parseSenvArgs } from "senv";

// Pass everything after the script name (or your app name).
configure(parseSenvArgs(process.argv.slice(2)));
```

If you use a CLI framework (e.g. yargs, commander), you can map its options to the same config shape and call `configure()` with that object instead of (or in addition to) `parseSenvArgs()`.

---

## senv-zod

**senv-zod** provides a validator that uses Zod schemas. Values from set/env/context are strings; use `z.coerce.number()`, `z.coerce.boolean()`, etc., to parse them.

```ts
import { senv } from "senv";
import { validator } from "senv-zod";
import { z } from "zod";

const port = senv("Port", {
  key: "port",
  env: "PORT",
  default: 3000,
  validator: validator(z.coerce.number().min(1).max(65535)),
});

const debug = senv("Debug", {
  key: "debug",
  default: false,
  validator: validator(
    z.union([z.boolean(), z.literal("true"), z.literal("false")])
      .transform((v) => v === true || v === "true")
  ),
});
```

Install: `pnpm add senv senv-zod zod`.

---

## senv-inquirer

**senv-inquirer** provides a `prompt()` that returns a function suitable for the variable `prompt` option. Senv calls that function with `(name, defaultValue)` when it needs to prompt; you do not pass the name or default yourself.

```ts
import { senv } from "senv";
import { prompt } from "senv-inquirer";

const api_url = senv("API URL", {
  default: "http://localhost:4000",
  prompt: prompt(),
});
```

Install: `pnpm add senv senv-inquirer inquirer`.

---

## Combining config sources

Typical setup:

1. **Default** – `senv.config.json` in the project with `contexts`, `prompt`, etc.
2. **Environment** – CI or shell sets `SENV_PROMPT=never`, `SENV_ADD_CONTEXTS=prod`, etc.
3. **CLI** – App calls `configure(parseSenvArgs(process.argv.slice(2)))` so `--set`, `--context`, and other flags override.

Variable definitions stay the same; only the merged config changes how resolution and saving behave.
