# API reference

## Core

### `scenv<T>(name, options?)`

Creates a scenv variable.

- **name** (string) – Display name (used in prompts and errors).
- **options** (object, optional):
  - **key** (string) – Key used in env and context. Default: derived from name (lowercase, spaces to underscores, non-alphanumeric stripped).
  - **env** (string) – Environment variable name. Default: derived from key (uppercase, hyphens to underscores).
  - **default** (T) – Default value when nothing is set from set/env/context.
  - **validator** (function) – `(val: T) => boolean | { success: true; data?: T } | { success: false; error?: unknown }`. Called with the resolved (or prompted) value.
  - **prompt** (function) – `(name: string, defaultValue: T) => T | Promise<T>`. Called when config says to prompt; receives the variable name and the current default.

**Returns:** An object with:

- **get()** – `Promise<T>`. Resolves the value; throws if missing or validation fails.
- **safeGet()** – `Promise<{ success: true; value: T } | { success: false; error?: unknown }>`. Never throws.
- **save(value?: T)** – `Promise<void>`. Writes the value (or the last resolved value) to a context file.

---

### `configure(partial)`

Merges config and optional callbacks into the programmatic layer. Precedence: programmatic over env over file.

- **partial** – `Partial<ScenvConfig>` and optionally `{ callbacks: ScenvCallbacks }`.
  - Config keys: `contexts`, `addContexts`, `prompt`, `ignoreEnv`, `ignoreContext`, `set`, `savePrompt`, `saveContextTo`, `root`.
  - **callbacks**: `{ onAskSaveAfterPrompt?, onAskContext? }` (see [Saving](SAVING.md)).

---

### `loadConfig(root?)`

Returns the fully merged config.

- **root** (string, optional) – Start directory when searching for `scenv.config.json`. If omitted, uses programmatic `root` or `process.cwd()`.

**Returns:** `ScenvConfig` with at least `root`, `contexts` (array), and the rest of the config keys.

---

### `resetConfig()`

Clears programmatic config and callbacks. Mainly for tests.

---

### `getCallbacks()`

Returns a copy of the currently configured callbacks (`onAskSaveAfterPrompt`, `onAskContext`).

---

### `parseScenvArgs(argv)`

Parses an argv slice (e.g. `process.argv.slice(2)`) into a partial config for `configure()`.

**Supported flags:**

- `--context a,b,c` – Set contexts (replace).
- `--add-context a,b` – Add contexts.
- `--prompt always|never|fallback|no-env`
- `--ignore-env`
- `--ignore-context`
- `--set key=value` (multiple allowed)
- `--set=key=value`
- `--save-prompt always|never|ask`
- `--save-context-to name`

**Returns:** `Partial<ScenvConfig>`.

---

### `getContextValues()`

Returns the merged context key-value map (string keys and values) for the current config. Respects `ignoreContext`.

---

### `discoverContextPaths(dir, found?)`

Recursively finds all `*.context.json` files under `dir`.

- **dir** – Root directory to search.
- **found** (Map, optional) – If provided, results are added to this map.

**Returns:** Map from context name to absolute file path.

---

## Types

- **ScenvConfig** – Full config shape (see [Configuration](CONFIGURATION.md)).
- **PromptMode** – `"always" | "never" | "fallback" | "no-env"`.
- **SavePromptMode** – `"always" | "never" | "ask"`.
- **ScenvCallbacks** – `{ onAskSaveAfterPrompt?, onAskContext? }`.
- **ScenvVariable&lt;T&gt;** – `{ get(), safeGet(), save(value?) }`.
