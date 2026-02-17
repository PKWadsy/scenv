# Saving

Scenv can write variable values into context files so they can be resolved in future runs. Saving is controlled by config and optional callbacks.

---

## `variable.save(value?)`

Calling **`variable.save(value?)`** writes the variable’s key and value to a context file.

- **Value:** If you pass `value`, that value is validated (if the variable has a validator) and written. Otherwise, the value used is the last resolved value (as if you had just called `get()`), so no extra prompt for the value.
- **No “save?” prompt:** `save()` does *not* ask “do you want to save?”. It saves. The only interactive part is *which context* to save to when that is ambiguous (see below).

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
    onAskSaveAfterPrompt: async (variableName, value, contextNames) => {
      // Called after the user was prompted for a value and savePrompt is "ask" or "always".
      // Return context name to save to, or null to skip saving.
      return "saved";
      // or return null;
    },
  },
});
```

- **`onAskContext`** – **Required** when `saveContextTo` is `"ask"`. Used when you call `variable.save()`; your app can prompt for a context name or create a new one. Throws if `saveContextTo` is `"ask"` and this callback is not set.
- **`onAskSaveAfterPrompt`** – **Required** when `savePrompt` is `"ask"` or `"always"` and the user is prompted for a value. Called after prompt during `get()`; return a context name to save, or `null` to skip. Throws if `savePrompt` is ask/always, the user was prompted, and this callback is not set.

---

## savePrompt

**`savePrompt`** only affects the “save after prompt” flow (after the user entered a value during resolution):

| Value | Behavior |
|-------|----------|
| `never` | Never ask to save after a prompt. |
| `ask` | After the user was *just* prompted for a value, call `onAskSaveAfterPrompt` to ask whether (and where) to save. |
| `always` | After any prompt, call `onAskSaveAfterPrompt` (same as above). |

So: **`variable.save()`** never shows a “save?” prompt; it only may ask for the context via `onAskContext` when `saveContextTo` is `"ask"`. The “save for next time?” behavior is only when the user was prompted for a value and `savePrompt` is `ask` or `always`, and then `onAskSaveAfterPrompt` is used to decide whether and where to save.
