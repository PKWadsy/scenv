import { loadConfig, getCallbacks } from "./config.js";
import { getMergedContextValues, getContext, writeToContext } from "./context.js";
import { log, logConfigLoaded } from "./log.js";

/** Matches @<context>:<key> for context-reference resolution. */
const CONTEXT_REF_REGEX = /^@([^:]+):(.+)$/;
const MAX_CONTEXT_REF_DEPTH = 10;

/**
 * If the string matches @<context>:<key>, resolve it from that context file (with recursion up to MAX_CONTEXT_REF_DEPTH).
 * Throws if the context is not found or the key is not in that context. Otherwise returns the string as-is.
 */
function resolveContextReference(raw: string, depth = 0): string {
  if (depth >= MAX_CONTEXT_REF_DEPTH) {
    throw new Error(
      `Context reference resolution exceeded max depth (${MAX_CONTEXT_REF_DEPTH}): possible circular reference`
    );
  }
  const match = raw.match(CONTEXT_REF_REGEX);
  if (!match) return raw;
  const [, contextName, refKey] = match;
  const ctx = getContext(contextName);
  const resolved = ctx[refKey];
  if (resolved === undefined) {
    const hasContext = Object.keys(ctx).length > 0;
    const msg = hasContext
      ? `Context reference @${contextName}:${refKey} could not be resolved: key "${refKey}" is not defined in context "${contextName}".`
      : `Context reference @${contextName}:${refKey} could not be resolved: context "${contextName}" not found (no ${contextName}.context.json).`;
    log("error", msg);
    throw new Error(msg);
  }
  return resolveContextReference(resolved, depth + 1);
}

/**
 * Return type for a variable's optional `validator` function. Use a boolean for simple
 * pass/fail, or an object to pass a transformed value or a custom error.
 * - `true` or `{ success: true, data?: T }` – validation passed; optional `data` replaces the value.
 * - `false` or `{ success: false, error?: unknown }` – validation failed; `.get()` throws with the error.
 */
export type ValidatorResult<T> =
  | boolean
  | { success: true; data?: T }
  | { success: false; error?: unknown };

/**
 * Prompt function signature. Called when config requests prompting for this variable.
 * Receives the variable's display name and the current default (from set/env/context or option default).
 * Return the value to use (sync or async). Used as the variable's `prompt` option or in get({ prompt: fn }).
 */
export type PromptFn<T> = (name: string, defaultValue: T) => T | Promise<T>;

function defaultKeyFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/gi, "");
}

function defaultEnvFromKey(key: string): string {
  return key.toUpperCase().replace(/-/g, "_");
}

function normalizeValidatorResult(
  result: ValidatorResult<unknown>
): { success: true; data?: unknown } | { success: false; error?: unknown } {
  if (typeof result === "boolean") {
    return result ? { success: true } : { success: false };
  }
  if (result.success === true) return result;
  return result;
}

/**
 * Options when creating a variable with {@link scenv}. All properties are optional.
 * If you omit `key` and `env`, they are derived from `name`: e.g. "API URL" → key `api_url`, env `API_URL`.
 */
export interface ScenvVariableOptions<T> {
  /** Internal key for --set, context files, and env. Default: name lowercased, spaces → underscores, non-alphanumeric stripped (e.g. "API URL" → "api_url"). */
  key?: string;
  /** Environment variable name (e.g. API_URL). Default: key uppercased, hyphens → underscores. */
  env?: string;
  /** Fallback when nothing is provided via --set, env, or context (and we're not prompting). */
  default?: T;
  /** Optional. Run after value is resolved or prompted. Return true / { success: true } to accept, false / { success: false, error } to reject (get() throws). Use to coerce types or enforce rules. */
  validator?: (val: T) => ValidatorResult<T>;
  /** Optional. Called when config says to prompt (e.g. prompt: "fallback" and no value found). Overrides callbacks.defaultPrompt for this variable. */
  prompt?: PromptFn<T>;
}

/**
 * Overrides for a single get() or safeGet() call. Only that call is affected.
 */
export interface GetOptions<T> {
  /** Use this prompt for this call only (e.g. a one-off inquirer prompt). */
  prompt?: PromptFn<T>;
  /** Use this as the default for this call when no value from set/env/context. */
  default?: T;
}

/**
 * A scenv variable: a named setting (e.g. "API URL") whose value is resolved from CLI overrides (--set),
 * then environment variables, then context files, then default (or an optional prompt). You call get() or
 * safeGet() to read the value; optionally save() to persist it to a context file for next time.
 */
export interface ScenvVariable<T> {
  /**
   * Resolve and return the value. Uses resolution order (set > env > context > default) and any prompt/validator.
   * @throws If no value is found and no default/prompt, or if validation fails.
   */
  get(options?: GetOptions<T>): Promise<T>;
  /**
   * Like get(), but never throws. Returns { success: true, value } or { success: false, error }.
   */
  safeGet(options?: GetOptions<T>): Promise<
    { success: true; value: T } | { success: false; error?: unknown }
  >;
  /**
   * Write the value to a context file (e.g. for next run). Target context comes from config.saveContextTo or onAskContext.
   * If you don't pass a value, the last resolved value is used. Does not prompt "save?"; it saves.
   */
  save(value?: T): Promise<void>;
}

/**
 * Creates a scenv variable: a named config value (e.g. API URL, port) that you read with get() or safeGet()
 * and optionally write with save(). You pass a display name and optional options; key and env are derived from
 * the name if you omit them.
 *
 * ## Resolution (how get() gets a value)
 *
 * get() first looks for a raw value in this order, stopping at the first found:
 * - Set overrides from config (e.g. from --set key=value or configure({ set: { key: "value" } }))
 * - Environment variable (e.g. API_URL for key "api_url")
 * - Context files (merged key-value from the context list in config, e.g. dev.context.json)
 *
 * If config says to prompt (see prompt mode in config: "always", "fallback", "no-env"), the prompt callback
 * may run. When it runs, it receives the variable name and a suggested value (the raw value if any, otherwise
 * the default option). The callback's return value is used as the value. When we don't prompt, we use the
 * raw value if present, otherwise the default option, otherwise get() throws (no value).
 *
 * ## Validator
 *
 * If you pass a validator option, it is called with the resolved or prompted value. It can return true or
 * { success: true } to accept, or false or { success: false, error } to reject; on reject, get() throws.
 * Use it to coerce types (e.g. string to number) or enforce rules.
 *
 * ## save()
 *
 * The variable has a save(value?) method. It writes the value (or the last resolved value if you omit it)
 * to a context file. The target context comes from config.saveContextTo or from the onAskContext callback
 * when saveContextTo is "ask". save() does not ask "save?"; it saves. Optional "save after prompt" behavior
 * is controlled by config.shouldSavePrompt and callbacks.onAskWhetherToSave.
 *
 * @typeParam T - Value type (default string). Use a validator to coerce to number, boolean, etc.
 * @param name - Display name used in prompts and errors. If you omit key/env, key is derived from name (e.g. "API URL" → "api_url") and env from key (e.g. "API_URL").
 * @param options - Optional. key, env, default, validator, prompt. See {@link ScenvVariableOptions}.
 * @returns A {@link ScenvVariable} with get(), safeGet(), and save().
 *
 * @example
 * const apiUrl = scenv("API URL", { default: "http://localhost:4000" });
 * const url = await apiUrl.get();
 */
export function scenv<T>(
  name: string,
  options: ScenvVariableOptions<T> = {}
): ScenvVariable<T> {
  const key = options.key ?? defaultKeyFromName(name);
  const envKey = options.env ?? defaultEnvFromKey(key);
  const validator = options.validator;
  const promptFn = options.prompt;
  const defaultValue = options.default;

  type ResolveSource = "set" | "env" | "context";

  async function resolveRaw(): Promise<{
    raw: string | undefined;
    source: ResolveSource | undefined;
  }> {
    const config = loadConfig();
    log("trace", `resolveRaw: checking set for key=${key}`);
    if (config.set?.[key] !== undefined) {
      log("trace", `resolveRaw: set hit key=${key}`);
      const raw = resolveContextReference(config.set[key]);
      return { raw, source: "set" };
    }
    if (!config.ignoreEnv) {
      log("trace", `resolveRaw: checking env ${envKey}`);
      const envVal = process.env[envKey];
      if (envVal !== undefined && envVal !== "") {
        log("trace", "resolveRaw: env hit");
        const raw = resolveContextReference(envVal);
        return { raw, source: "env" };
      }
    }
    if (!config.ignoreContext) {
      log("trace", "resolveRaw: checking context");
      const ctx = getMergedContextValues();
      if (ctx[key] !== undefined) {
        log("trace", `resolveRaw: context hit key=${key}`);
        const raw = resolveContextReference(ctx[key]);
        return { raw, source: "context" };
      }
    }
    log("trace", "resolveRaw: no value");
    return { raw: undefined, source: undefined };
  }

  function shouldPrompt(
    config: ReturnType<typeof loadConfig>,
    hadValue: boolean,
    hadEnv: boolean
  ): boolean {
    const mode = config.prompt ?? "fallback";
    if (mode === "never") return false;
    if (mode === "always") return true;
    if (mode === "fallback") return !hadValue;
    if (mode === "no-env") return !hadEnv;
    return false;
  }

  async function getResolvedValue(
    overrides?: GetOptions<T>
  ): Promise<{
    value: T;
    raw: string | undefined;
    hadEnv: boolean;
    wasPrompted: boolean;
  }> {
    const config = loadConfig();
    logConfigLoaded(config);
    const { raw, source } = await resolveRaw();
    const hadEnv =
      !config.ignoreEnv &&
      process.env[envKey] !== undefined &&
      process.env[envKey] !== "";
    const hadValue = raw !== undefined;
    const doPrompt = shouldPrompt(config, hadValue, hadEnv);
    log(
      "debug",
      `prompt decision key=${key} prompt=${config.prompt ?? "fallback"} hadValue=${hadValue} hadEnv=${hadEnv} -> ${doPrompt ? "prompt" : "no prompt"}`
    );
    const effectiveDefault = overrides?.default !== undefined ? overrides.default : defaultValue;
    const resolvedDefault =
      effectiveDefault === undefined
        ? undefined
        : (typeof effectiveDefault === "string"
            ? resolveContextReference(effectiveDefault)
            : effectiveDefault) as T | undefined;
    let wasPrompted = false;
    let value: T;
    let resolvedFrom: ResolveSource | "default" | "prompt";
    if (doPrompt) {
      const callbacks = getCallbacks();
      const fn =
        overrides?.prompt ?? promptFn ?? callbacks.defaultPrompt;
      if (typeof fn !== "function") {
        throw new Error(
          `Prompt required for variable "${name}" (key: ${key}) but no prompt was supplied and no defaultPrompt callback is configured. Set a prompt on the variable or configure({ callbacks: { defaultPrompt: ... } }).`
        );
      }
      const defaultForPrompt =
        raw !== undefined ? (raw as unknown as T) : resolvedDefault;
      let promptedValue = (await Promise.resolve(fn(name, defaultForPrompt as T))) as T;
      value =
        typeof promptedValue === "string"
          ? (resolveContextReference(promptedValue) as T)
          : promptedValue;
      wasPrompted = true;
      resolvedFrom = "prompt";
    } else if (raw !== undefined) {
      value = raw as unknown as T;
      resolvedFrom = source!;
    } else if (resolvedDefault !== undefined) {
      value = resolvedDefault;
      resolvedFrom = "default";
    } else {
      throw new Error(`Missing value for variable "${name}" (key: ${key})`);
    }
    log("info", `variable "${name}" (key=${key}) resolved from ${resolvedFrom}`);
    return { value, raw, hadEnv, wasPrompted };
  }

  function validate(value: T): { success: true; data: T } | { success: false; error: unknown } {
    if (!validator) return { success: true, data: value };
    const result = validator(value);
    const normalized = normalizeValidatorResult(result);
    if (normalized.success) {
      const data = ("data" in normalized && normalized.data !== undefined
        ? normalized.data
        : value) as T;
      return { success: true, data };
    }
    return {
      success: false,
      error: "error" in normalized ? normalized.error : undefined,
    };
  }

  async function get(options?: GetOptions<T>): Promise<T> {
    const { value, wasPrompted } = await getResolvedValue(options);
    const validated = validate(value);
    if (!validated.success) {
      const errMsg = `Validation failed for "${name}": ${validated.error ?? "unknown"}`;
      log("error", errMsg);
      throw new Error(errMsg);
    }
    const final = validated.data;
    if (wasPrompted) {
      const config = loadConfig();
      const mode =
        config.shouldSavePrompt ?? (config.prompt === "never" ? "never" : "ask");
      if (mode === "never") return final;
      let doSave: boolean;
      if (mode === "ask") {
        const callbacks = getCallbacks();
        if (typeof callbacks.onAskWhetherToSave !== "function") {
          throw new Error(
            `shouldSavePrompt is "ask" but onAskWhetherToSave callback is not set. Configure callbacks via configure({ callbacks: { onAskWhetherToSave: ... } }).`
          );
        }
        doSave = await callbacks.onAskWhetherToSave(name, final);
      } else {
        doSave = true; // always: save without asking
      }
      if (!doSave) return final;
      const callbacks = getCallbacks();
      const contextNames = config.context ?? [];
      let ctxToSave: string;
      if (config.saveContextTo === "ask") {
        if (typeof callbacks.onAskContext !== "function") {
          throw new Error(
            `saveContextTo is "ask" but onAskContext callback is not set. Configure callbacks via configure({ callbacks: { onAskContext: ... } }).`
          );
        }
        ctxToSave = await callbacks.onAskContext(name, contextNames);
      } else {
        ctxToSave = config.saveContextTo ?? contextNames[0] ?? "default";
      }
      writeToContext(ctxToSave, key, String(final));
      log("info", `Saved key=${key} to context ${ctxToSave}`);
    }
    return final;
  }

  async function safeGet(options?: GetOptions<T>): Promise<
    { success: true; value: T } | { success: false; error?: unknown }
  > {
    try {
      const v = await get(options);
      return { success: true, value: v };
    } catch (err) {
      return { success: false, error: err };
    }
  }

  async function save(value?: T): Promise<void> {
    const toSave = value ?? (await getResolvedValue()).value;
    const validated = validate(toSave);
    if (!validated.success) {
      const errMsg = `Validation failed for "${name}": ${validated.error ?? "unknown"}`;
      log("error", errMsg);
      throw new Error(errMsg);
    }
    const config = loadConfig();
    let contextName: string | undefined = config.saveContextTo;
    if (contextName === "ask") {
      const callbacks = getCallbacks();
      if (typeof callbacks.onAskContext !== "function") {
        throw new Error(
          `saveContextTo is "ask" but onAskContext callback is not set. Configure callbacks via configure({ callbacks: { onAskContext: ... } }).`
        );
      }
      contextName = await callbacks.onAskContext(
        name,
        config.context ?? []
      );
    }
    if (!contextName) contextName = config.context?.[0] ?? "default";
    writeToContext(contextName, key, String(validated.data));
    log("info", `Saved key=${key} to context ${contextName}`);
  }

  return { get, safeGet, save };
}

