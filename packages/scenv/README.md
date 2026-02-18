# scenv

Environment and context variables with runtime-configurable resolution.

Define variables once with `scenv()`, then resolve values from **set overrides** (e.g. CLI `--set`), **environment**, **context files**, or **defaults**. Control behavior via config (file, env, or `configure()`)—same code, different config per run.

**Requires Node 18+.**

## Install

```bash
pnpm add scenv
# or
npm install scenv
```

## Quick start

```ts
import { configure, parseScenvArgs, scenv } from "scenv";

// Optional: apply CLI flags (--set, --context, --prompt, etc.)
configure(parseScenvArgs(process.argv.slice(2)));

const apiUrl = scenv("API URL", {
  key: "api_url",
  env: "API_URL",
  default: "http://localhost:4000",
});

const url = await apiUrl.get(); // throws if missing or invalid
const result = await apiUrl.safeGet(); // { success, value? } | { success: false, error? }
await apiUrl.save(); // write current value to a context file
```

## Resolution order

1. **Set overrides** – e.g. `--set key=value`
2. **Environment** – `process.env[envKey]`
3. **Context** – merged JSON context files
4. **Default** – variable’s `default` option

Any string value matching **`@<context>:<key>`** (e.g. `@prod:core_server_url`) is resolved from that context file first—in set, env, context, default, and prompts.

Prompting (when to ask the user) is controlled by config `prompt`: `always` | `never` | `fallback` | `no-env`.

## Optional integrations

| Package                                                        | Purpose                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| [scenv-zod](https://www.npmjs.com/package/scenv-zod)           | `validator(zodSchema)` for type-safe validation and coercion. |
| [scenv-inquirer](https://www.npmjs.com/package/scenv-inquirer) | `prompt()` and callbacks for interactive prompts.             |

## Documentation

Full docs (config, contexts, resolution, saving, API) live in the [monorepo](https://github.com/PKWadsy/scenv):

- [Configuration](https://github.com/PKWadsy/scenv/blob/main/docs/CONFIGURATION.md)
- [Contexts](https://github.com/PKWadsy/scenv/blob/main/docs/CONTEXTS.md)
- [Resolution](https://github.com/PKWadsy/scenv/blob/main/docs/RESOLUTION.md)
- [Saving](https://github.com/PKWadsy/scenv/blob/main/docs/SAVING.md)
- [API reference](https://github.com/PKWadsy/scenv/blob/main/docs/API.md)
- [Integration (scenv-zod, scenv-inquirer)](https://github.com/PKWadsy/scenv/blob/main/docs/INTEGRATION.md)

## License

MIT
