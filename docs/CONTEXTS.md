# Contexts

A **context** is a JSON file named `{contextName}.context.json`. Scenv discovers these files recursively from the **current working directory** (cwd) and merges their key-value pairs in a defined order. New context files are saved under the **project root** (where `scenv.config.json` was found, or cwd). Context values are used during variable resolution when `ignoreContext` is not set.

---

## Context files

- **Naming:** `{name}.context.json` (e.g. `prod.context.json`, `dev.context.json`).
- **Location:** Context files are discovered by searching recursively from the current working directory. The **first** file found for a given context name wins. New context files (when you save) are written under the project root.
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

The **context list** is the ordered set of context names that scenv loads and merges. It is built from:

- **Replace:** `context: ["a", "b"]` (or `--context a,b` or `SCENV_CONTEXT=a,b`) replaces the entire list with the given names.
- **Merge:** `addContext: ["c"]` (or `--add-context c` or `SCENV_ADD_CONTEXT=c`) appends names to the existing list.

Precedence for defining the list: programmatic over env over file. So if the file has `context: ["file"]` and you call `configure({ context: ["prog"] })`, the effective list is `["prog"]`.

For each variable key, scenv looks up the value in the **merged** context map: it loads each context file in the list order and overwrites the map with that file's entries. So **later contexts override earlier ones** for the same key.

Example: list `["base", "overlay"]`.

- `base.context.json`: `{ "database_url": "postgres://localhost/base", "region": "us-east" }`
- `overlay.context.json`: `{ "database_url": "postgres://prod.example.com/overlay" }`

Merged map: `database_url` from overlay, `region` from base. So `database_url` resolves to the overlay value.

If you change the list to `["overlay", "base"]`, then base is applied after overlay, so `database_url` would come from base.

---

## Discovery: discoverContextPaths()

`discoverContextPaths(dir)` recursively scans `dir` for `*.context.json` files and returns a `Map` from context name to absolute path. The same name appearing in more than one path: the first path found is kept. Scenv uses this internally when resolving context values and when writing to a context.

You can use it yourself to inspect where context files would be found from a given directory (e.g. cwd):

```ts
import { discoverContextPaths } from "scenv";

const paths = discoverContextPaths(process.cwd());
for (const [name, path] of paths) {
  console.log(name, "->", path);
}
```

---

## Reading merged values: getMergedContextValues()

`getMergedContextValues()` returns a single object: all context key-value pairs merged in context order (later overwrites earlier). Only string values are included. This is what variable resolution uses when `ignoreContext` is false.

---

## Reading a single context: getContext()

`getContext(contextName, root?)` loads key-value pairs from one context file (e.g. `prod.context.json`). It does not depend on the configured context list or `ignoreContext`. The optional `root` is the directory to search; if omitted, uses `process.cwd()`. Scenv uses it when resolving **context references** (see [Resolution – Context references](RESOLUTION.md#context-references-contextkey)): any value that looks like `@<context>` or `@<context>:<key>` is replaced by the value from that context (short form uses the variable’s key). You can call `getContext` yourself to inspect or reuse a single context’s values.

---

## Writing to a context

When you call `variable.save()` or when a value is resolved via a prompt (see [Saving](SAVING.md)), scenv stores the value in the in-memory context (so the next `get()` in the same process sees it). If **`saveContextTo`** is set, the value is also written to that context file.

- **saveContextTo** can be a context name (e.g. `"my-saves"`) or a file path without the `.context.json` suffix. The file path is from discovery (from cwd) for a name, or the given path with `.context.json` appended for a path.
- For a new context name, the file is created under the **project root** (where `scenv.config.json` was found, or cwd).

The file is updated by merging the new key-value pair with the existing JSON and writing it back.
