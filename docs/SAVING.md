# Saving

Scenv can store variable values so they are available for the rest of the current process and, optionally, for future runs. Saving is controlled by **`saveContextTo`** only; there are no "save?" or "where to save?" prompts.

---

## `saveContextTo`

**`saveContextTo`** is an optional config value (context name or file path, without the `.context.json` suffix):

- **Unset** – Resolved and saved values are stored **in memory** only. They are used for the rest of the current process (e.g. a second `get()` on the same variable does not prompt again), but are not written to disk.
- **Set** (e.g. `"my-saves"` or `"/path/to/myfile"`) – All saved values are written to that context file. The same context is also **used when resolving** (before prompting), so values are available on the next run and a second `get()` in the same run does not prompt again.

You are never asked whether to save or where to save; behavior is determined entirely by whether `saveContextTo` is set.

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
3. **In-memory context** (values from earlier `get()` or `save()` in this process)
4. **saveContextTo context** (if set) – loaded from file and merged with other context files
5. Config context list (context files in order)
6. Default or prompt

So if you call `get()` on the same variable twice and the first call prompted for a value, the second call uses the in-memory (and file, if `saveContextTo` is set) value and does not prompt again.
