# Saving

Scenv can write variable values into context files so they can be resolved in future runs. Saving is controlled by config and optional callbacks.

---

## `variable.save(value?)`

Calling **`variable.save(value?)`** writes the variable's key and value to a context file.

- **Value:** If you pass `value`, that value is validated (if the variable has a validator) and written. Otherwise, the value used is the last resolved value (as if you had just called `get()`), so no extra prompt for the value.
- **No "save?" prompt:** `save()` does *not* ask "do you want to save?". It saves. The only interactive part is *which context* to save to when that is ambiguous (see below).

---

## Which context is written to

The target context is determined by **`saveContextTo`**:

- **String** (e.g. `"my-saves"`) – Save to that context. The file path is the one discovered for that name, or `{root}/{name}.context.json` if the context is new.
- **`"ask"`** – Scenv calls the **`onAskContext`** callback so your app can decide (e.g. prompt the user or pick from a list). The callback is **required**: if `saveContextTo` is `"ask"` and `onAskContext` is not set, `save()` throws.

If `saveContextTo` is unset or not `"ask"`, scenv uses the first context in the config context list, or `"default"`.

---

## Callbacks

Set callbacks when calling **`configure()`**:

```ts
configure({
  callbacks: {
    onAskContext: async (variableName, contextNames) => {
      // Return the context name to save to (e.g. from user input or list).
      return "my-context";
    },
    onAskWhetherToSave: async (variableName, value) => {
      // Only called when shouldSavePrompt is "ask" or "always" and the user was just prompted.
      // Return true to save, false to skip. Where to save is resolved separately (saveContextTo or onAskContext).
      return true;
    },
  },
});
```

- **`onAskContext`** – **Required** when `saveContextTo` is `"ask"`. Used when you call `variable.save()` or when saving after a prompt and the destination is "ask"; your app can prompt for a context name or create a new one. Throws if `saveContextTo` is `"ask"` and this callback is not set.
- **`onAskWhetherToSave`** – Only called when **`shouldSavePrompt`** is `"ask"` or `"always"` and the user was just prompted for a value during `get()`. Return `true` to save (then scenv uses `saveContextTo` or calls `onAskContext` if destination is "ask"), or `false` to skip saving.

---

## shouldSavePrompt

**`shouldSavePrompt`** only affects the "save after prompt" flow (after the user entered a value during resolution). When unset, the default is **`ask`** unless **`prompt`** is **`never`**, in which case the default is **`never`** (so non-interactive runs never ask to save).

| Value | Behavior |
|-------|----------|
| `never` | Never ask to save after a prompt. |
| `ask` | After the user was *just* prompted for a value, call `onAskWhetherToSave` to ask whether to save. If true, the destination is `saveContextTo` or (if "ask") `onAskContext`. |
| `always` | Same as `ask` for the "after prompt" flow. |

So: **`variable.save()`** never shows a "save?" prompt; it only may ask for the context via `onAskContext` when `saveContextTo` is `"ask"`. The "save for next time?" behavior is only when the user was prompted for a value and `shouldSavePrompt` is `ask` or `always`: then `onAskWhetherToSave` decides whether to save, and the destination is either the configured context or `onAskContext` when `saveContextTo` is `"ask"`.
