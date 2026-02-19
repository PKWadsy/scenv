# Saving

Scenv can store variable values so they are available for the rest of the current process and, optionally, for future runs. Saving is controlled by **`saveContextTo`** only; there are no "save?" or "where to save?" prompts.

---

## `saveContextTo`

**`saveContextTo`** is an optional config value (context name or file path, without the `.context.json` suffix):

- **Unset** – Resolved and saved values are stored **in memory** only. They are used for the rest of the current process (e.g. a second `get()` on the same variable does not prompt again), but are not written to disk.
- **Set** (e.g. `"my-saves"` or `"/path/to/myfile"`) – All saved values are written to that context file. It is **not** used for resolution unless you add it to the context list (e.g. `--context my-saves`). A second `get()` in the same run does not prompt again because prompted values are stored in-memory.

You are never asked whether to save or where to save; behavior is determined entirely by whether `saveContextTo` is set.

---

## `saveMode`

When `saveContextTo` is set, **`saveMode`** controls when resolved values are written to that file during `get()`:

- **`"all"`** (default) – Every resolved value (from set, env, context, default, or prompt) is written. Useful for re-running the same query with the same variables.
- **`"prompts-only"`** – Only values that came from a user prompt are written. Matches the classic behaviour where the file only stores what the user typed.

Prompted values are always stored in-memory so you are not prompted twice for the same variable in one process. `save()` always writes to the file (when `saveContextTo` is set) and to in-memory.

---

## `variable.save(value?)`

Calling **`variable.save(value?)`** stores the variable's key and value:

- **Value:** If you pass `value`, that value is validated (if the variable has a validator) and stored. Otherwise, the last resolved value (as if you had just called `get()`) is used.
- **Where:** If `saveContextTo` is set, the value is written to that context file. In all cases, the value is stored in the in-memory context so the next `get()` sees it without prompting.

`save()` does not ask any questions; it just saves.

---

## Resolution order and in-memory context

When resolving a variable, scenv looks in this order:

1. Set overrides (e.g. `--set key=value`)
2. Environment variable
3. **In-memory context** (values from earlier `get()` or `save()` in this process, including prompted values)
4. Config context list (context files in order; only contexts you added via `context` or `addContext`)
5. Default or prompt

So if you call `get()` on the same variable twice and the first call prompted for a value, the second call uses the in-memory value and does not prompt again. `saveContextTo` is only a write target; add it to the context list if you want its file used for resolution on the next run.
