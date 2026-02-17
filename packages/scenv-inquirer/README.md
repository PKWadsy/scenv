# scenv-inquirer

Inquirer-based prompts for [scenv](https://www.npmjs.com/package/scenv): variable prompts and save/context callbacks.

Use with scenv when you want interactive prompts for variable values and for "save to context?" / "which context?" flows.

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

### Save and context callbacks

`askSaveAfterPrompt()` and `askContext()` return functions for scenv's `onAskSaveAfterPrompt` and `onAskContext` callbacks. Use them when `SCENV_SAVE_PROMPT=ask` or `saveContextTo: "ask"`.

**`callbacks()`** wires all of the above in one go:

```ts
import { configure } from "scenv";
import { callbacks } from "scenv-inquirer";

configure(callbacks());
// Or merge with other config:
configure({ ...yourConfig, ...callbacks() });
```

This sets:

- **defaultPrompt** – inquirer for variable values when no value is resolved
- **onAskSaveAfterPrompt** – "Save '{name}' for next time?" then "Which context?"
- **onAskContext** – "Save to which context?" (list or new)

## API

| Export | Description |
|--------|-------------|
| `prompt()` | Returns `(name, defaultValue) => Promise<T>` for use as variable `prompt` or `callbacks.defaultPrompt`. |
| `askSaveAfterPrompt()` | Returns `onAskSaveAfterPrompt`: asks whether to save and which context. |
| `askContext()` | Returns `onAskContext`: asks which context to save to. |
| `callbacks()` | Returns `{ callbacks: { defaultPrompt, onAskSaveAfterPrompt, onAskContext } }`. |

## License

MIT
