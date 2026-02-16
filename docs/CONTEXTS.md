# Contexts

A **context** is a JSON file named `{contextName}.context.json`. Senv discovers these files recursively under the config **root** directory and merges their key-value pairs in a defined order. Context values are used during variable resolution when `ignoreContext` is not set.

---

## Context files

- **Naming:** `{name}.context.json` (e.g. `prod.context.json`, `dev.context.json`).
- **Location:** Anywhere under the root directory; senv searches recursively. The **first** file found for a given context name wins (search order is deterministic but implementation-dependent).
- **Format:** JSON object. Keys are variable keys (e.g. `api_url`, `port`). Values must be strings for resolution; non-string values are ignored when loading.

Example `prod.context.json`:

```json
{
  "api_url": "https://api.example.com",
  "log_level": "warn",
  "port": "443"
}
```

---

## Context list and merge order

The **context list** is the ordered set of context names that senv loads and merges. It is built from:

- **Replace:** `contexts: ["a", "b"]` (or `--context a,b` or `SENV_CONTEXT=a,b`) replaces the entire list with the given names.
- **Merge:** `addContexts: ["c"]` (or `--add-context c` or `SENV_ADD_CONTEXTS=c`) appends names to the existing list.

Precedence for defining the list: programmatic over env over file. So if the file has `contexts: ["file"]` and you call `configure({ contexts: ["prog"] })`, the effective list is `["prog"]`.

For each variable key, senv looks up the value in the **merged** context map: it loads each context file in the list order and overwrites the map with that file's entries. So **later contexts override earlier ones** for the same key.

Example: list `["base", "overlay"]`.

- `base.context.json`: `{ "database_url": "postgres://localhost/base", "region": "us-east" }`
- `overlay.context.json`: `{ "database_url": "postgres://prod.example.com/overlay" }`

Merged map: `database_url` from overlay, `region` from base. So `database_url` resolves to the overlay value.

If you change the list to `["overlay", "base"]`, then base is applied after overlay, so `database_url` would come from base.

---

## Discovery: discoverContextPaths()

`discoverContextPaths(dir)` recursively scans `dir` for `*.context.json` files and returns a `Map` from context name to absolute path. The same name appearing in more than one path: the first path found is kept. Senv uses this internally when resolving context values and when writing to a context.

You can use it yourself to inspect where context files were found:

```ts
import { loadConfig, discoverContextPaths } from "scenv";

const config = loadConfig();
const root = config.root ?? process.cwd();
const paths = discoverContextPaths(root);
for (const [name, path] of paths) {
  console.log(name, "->", path);
}
```

---

## Reading merged values: getContextValues()

`getContextValues()` returns a single object: all context key-value pairs merged in context order (later overwrites earlier). Only string values are included. This is what variable resolution uses when `ignoreContext` is false.

---

## Writing to a context

When you call `variable.save()` or when saving after a prompt (see [Saving](SAVING.md)), senv writes to a context file. The target context is determined by `saveContextTo`:

- If it is a string (e.g. `"my-saves"`), that context is used. The file path is the one from discovery, or `{root}/{contextName}.context.json` if the context is new.
- If it is `"ask"`, the `onAskContext` callback is called so your app can ask the user which context to use (or create a new name).

The file is updated by merging the new key-value pair with the existing JSON and writing it back.
