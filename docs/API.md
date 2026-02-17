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
  - **prompt** (function) – `(name: string, defaultValue: T) => T | Promise<T>`. Called when config says to prompt; receives the variable name and the current default. If the variable has no `prompt` and no `callbacks.defaultPrompt` is set, scenv throws when prompting would occur.

**Returns:** An object with:

- **get(options?)** – `Promise<T>`. Resolves the value; throws if missing or validation fails. **options** (optional): `{ prompt?, default? }` – override the prompt function or default for this call only.
- **safeGet(options?)** – `Promise<{ success: true; value: T } | { success: false; error?: unknown }>`. Never throws. Same optional **options** as `get()`.
- **save(value?: T)** – `Promise<void>`. Writes the value (or the last resolved value) to a context file.

---

### `configure(partial)`

Merges config and optional callbacks into the programmatic layer. Precedence: programmatic over env over file. You can call `configure()` multiple times; each call is **merged (shallow)** with the previous programmatic config and callbacks—later values overwrite earlier for the same key; objects like `set` and `callbacks` are replaced, not deep-merged.

- **partial** – `Partial<ScenvConfig>` and optionally `{ callbacks: ScenvCallbacks }`.
  - Config keys: `contexts`, `addContexts`, `prompt`, `ignoreEnv`, `ignoreContext`, `set`, `shouldSavePrompt`, `saveContextTo`, `root`, `logLevel`.
  - **callbacks**: `{ defaultPrompt?, onAskWhetherToSave?, onAskContext? }`. `defaultPrompt` is used when a variable has no `prompt` option (variable’s `prompt` overrides it). See [Saving](SAVING.md) for the others.

---

### `loadConfig(root?)`

Returns the fully merged config.

- **root** (string, optional) – Start directory when searching for `scenv.config.json`. If omitted, uses programmatic `root` or `process.cwd()`.

**Returns:** `ScenvConfig` with at least `root`, `contexts` (array), and the rest of the config keys.

---

### `resetConfig()`

Clears programmatic config and callbacks. Mainly for tests. For tests that change log level, you may also call `resetLogState()` to reset the internal config-loaded log guard.

---

### `resetLogState()`

Resets internal log state (e.g. the “config loaded” one-time log guard). Useful in tests after `resetConfig()` when asserting on log output.

---

### `getCallbacks()`

Returns a copy of the currently configured callbacks (`defaultPrompt`, `onAskWhetherToSave`, `onAskContext`).

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
- `--log-level level` / `--log level` / `--log=level` – Log level: `none` (default), `trace`, `debug`, `info`, `warn`, `error`.

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
- **LogLevel** – `"none" | "trace" | "debug" | "info" | "warn" | "error"`. Default is `none` (no logging).
- **PromptMode** – `"always" | "never" | "fallback" | "no-env"`.
- **SavePromptMode** – `"always" | "never" | "ask"`.
- **ScenvCallbacks** – `{ defaultPrompt?, onAskWhetherToSave?, onAskContext? }`.
- **DefaultPromptFn** – `(name, defaultValue) => value | Promise<value>`. Used as default when a variable has no `prompt`.
- **ScenvVariable&lt;T&gt;** – `{ get(options?), safeGet(options?), save(value?) }`.
- **GetOptions&lt;T&gt;** – `{ prompt?, default? }`. Optional overrides for a single `get()` or `safeGet()` call.
