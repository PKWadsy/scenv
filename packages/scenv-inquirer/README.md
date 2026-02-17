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

`askWhetherToSave()` and `askContext()` return functions for scenv's `onAskWhetherToSave` and `onAskContext` callbacks. Use them when `shouldSavePrompt` is `ask` or when `saveContextTo: "ask"`.

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
- **onAskWhetherToSave** – "Save '{name}' for next time?" (y/n). Only used when `shouldSavePrompt` is "ask".
- **onAskContext** – "Save to which context?" (list or new). Used when `saveContextTo` is "ask" or when saving after prompt and destination is "ask".

## API

| Export | Description |
|--------|-------------|
| `prompt()` | Returns `(name, defaultValue) => Promise<T>` for use as variable `prompt` or `callbacks.defaultPrompt`. |
| `askWhetherToSave()` | Returns `onAskWhetherToSave`: asks whether to save (y/n). Where to save is handled by `saveContextTo` or `onAskContext`. |
| `askContext()` | Returns `onAskContext`: asks which context to save to. |
| `callbacks()` | Returns `{ callbacks: { defaultPrompt, onAskWhetherToSave, onAskContext } }`. |

## License

MIT
