# scenv-inquirer

Inquirer-based prompts for [scenv](https://www.npmjs.com/package/scenv): variable prompts (and optional default prompt callback).

Use with scenv when you want interactive prompts for variable values. Saving is controlled by scenv's `saveContextTo` config (path or context name); there are no "save?" or "which context?" callbacks in scenv.

## Install

```bash
pnpm add scenv scenv-inquirer inquirer
# or
npm install scenv scenv-inquirer inquirer
```

**Peer dependencies:** `scenv`, `inquirer` (^8.0.0 or ^9.0.0).

## Usage

### Variable prompt

Use `prompt()` as the `prompt` option for a variable. Scenv calls it with `(name, defaultValue)` when it needs to ask the user.

```ts
import { scenv } from "scenv";
import { prompt } from "scenv-inquirer";

const apiUrl = scenv("API URL", {
  default: "http://localhost:4000",
  prompt: prompt(),
});

const url = await apiUrl.get(); // prompts via inquirer if no env/context/default
```

### Default prompt for all variables

Set `callbacks.defaultPrompt` so every variable that doesn't define its own `prompt` uses inquirer:

```ts
import { configure } from "scenv";
import { prompt } from "scenv-inquirer";

configure({ callbacks: { defaultPrompt: prompt() } });
```

Variable-level `prompt` overrides this default.

**`callbacks()`** returns an object you can pass to `configure()` so all variables use inquirer when they need a value:

```ts
import { configure } from "scenv";
import { callbacks } from "scenv-inquirer";

configure(callbacks());
// Or merge with other config:
configure({ ...yourConfig, ...callbacks() });
```

This sets **defaultPrompt** so variable values are prompted via inquirer when no value is resolved from set/env/context.

## API

| Export | Description |
|--------|-------------|
| `prompt()` | Returns `(name, defaultValue) => Promise<T>` for use as variable `prompt` or `callbacks.defaultPrompt`. |
| `callbacks()` | Returns `{ callbacks: { defaultPrompt } }` for use with `configure()`. |

## License

MIT
