# Resolution

When you call `variable.get()` or `variable.safeGet()`, the value is resolved in a fixed order. Optional prompting and validation run at defined points.

---

## Resolution order

For each variable, scenv looks up a **raw value** (string) only from:

1. **Set overrides** – If `config.set[key]` exists (e.g. from `--set key=value`), that string is used.
2. **Environment** – If `ignoreEnv` is false and `process.env[envKey]` is set and non-empty, that value is used. The env key is the variable’s `env` option or derived from `key` (e.g. `api_url` → `API_URL`).
3. **Context** – If `ignoreContext` is false, the merged context map from `getMergedContextValues()` is consulted for the variable’s `key`. The first (and only) value in that map for that key is used (context merge order is already applied when building the map).

The first step that yields a value wins. If none do, there is no raw value; then **prompt mode** (and optionally the variable’s **default**) determines the final value (see Prompt modes). The variable’s `default` is not part of “raw” resolution—it is used only when no value came from set/env/context and the user was not prompted (or after the prompt as the suggested default). If there is no raw value, no default, and no prompt (or prompt is not used), resolution is “missing” and `.get()` throws while `.safeGet()` returns `{ success: false, error }`.

---

## Env and context references

After a value is chosen from set, env, context, default, or prompt, scenv resolves **env references** first, then **context references**.

### Env references: `$VAR` and `${VAR}`

Any **`$VAR`** or **`${VAR}`** in the value is replaced by `process.env[VAR]`. Unset variables become an empty string. This applies in set overrides, env values, context file values, defaults, and prompt return values. Multiple refs in one string are expanded (e.g. `https://$HOST:$PORT`).

### Context references: `@context` and `@context:key`

After env expansion, two forms are supported:

- **`@<context>:<key>`** – Use the value at **key** in that **context** (e.g. `@prod:core_server_url` → value of `core_server_url` in `prod.context.json`).
- **`@<context>`** – Use the value at the **current variable’s key** in that context. For example, a variable with `key: "url"` and value `@prod` resolves to the value of `url` in `prod.context.json` (same as `@prod:url`).

Context refs apply everywhere: set overrides, environment variables, merged context values, variable **default**, and prompt return values.

Examples:

- `--set api_url=@prod:core_server_url` – use the value of `core_server_url` from `prod.context.json`.
- `--set url=@prod` – use the value of `url` from `prod.context.json` (variable key is `url`).
- `API_URL=@prod:core_server_url` – same as first, from the environment.
- A context file can store `"api_url": "@prod"`; that resolves to `api_url` in `prod.context.json`.
- A variable default can be `default: "@prod:core_server_url"` or `default: "@prod"` (latter uses the variable’s key in prod).
- A prompt callback can return `"@prod:core_server_url"` or `"@prod"` and it will be resolved.
- `--set url=$SOME_URL` – use the value of the `SOME_URL` environment variable.
- A context file can store `"api_url": "$EXTERNAL_API_URL"`; that is expanded from the environment.

References are resolved recursively (e.g. `@prod:a` → `@staging:b` → `"final"`) up to a safe depth. If the context is not found (no `{context}.context.json`) or the key is not in that context, resolution **throws** so you fail fast. The context file is discovered under the config **root** (same as other context files); `ignoreContext` does not prevent resolving these references.

---

## Prompt modes

Config key **`prompt`** controls *when* the user is prompted for a value. When prompting is needed, either the variable must have a `prompt` function or **`callbacks.defaultPrompt`** must be configured; otherwise scenv throws. The modes:

| Mode | When the user is prompted |
|------|----------------------------|
| `always` | Every time, regardless of whether a value was found from set/env/context/default. |
| `never` | Never. |
| `fallback` | Only when no value was found from set, env, or context (i.e. we would use default or nothing). |
| `no-env` | Only when the environment variable is not set. If the value comes from context (but not env), we still prompt. |

After the user (or prompt function) returns a value, that value is used and can be validated and optionally saved (see [Saving](SAVING.md)).

---

## Validation

If the variable has a **`validator`** option, it is called with the resolved (or prompted) value. The validator can return:

- `true` or `{ success: true }` or `{ success: true, data: T }` – success. If `data` is provided, it is used as the final value; otherwise the input value is used.
- `false` or `{ success: false }` or `{ success: false, error?: unknown }` – failure.

On failure, `.get()` throws; `.safeGet()` returns `{ success: false, error }`.

Values from set/env/context are always strings. Your validator can parse and coerce (e.g. with Zod via `scenv-zod`): use `z.coerce.number()`, etc., so that string inputs are converted before validation.

---

## get() vs safeGet()

- **`get()`** – Returns `Promise<T>`. Throws if the value is missing (and no default) or if validation fails.
- **`safeGet()`** – Returns `Promise<{ success: true, value: T } | { success: false, error?: unknown }>`. Never throws; use the result to handle success or failure in code.

Use `get()` when you want fail-fast behavior; use `safeGet()` when you want to branch on success/failure without try/catch.
