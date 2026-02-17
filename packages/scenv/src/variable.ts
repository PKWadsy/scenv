import { loadConfig, getCallbacks } from "./config.js";
import { getContextValues, writeToContext } from "./context.js";
import { log, logConfigLoaded } from "./log.js";

export type ValidatorResult<T> =
  | boolean
  | { success: true; data?: T }
  | { success: false; error?: unknown };

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

export interface ScenvVariableOptions<T> {
  key?: string;
  env?: string;
  default?: T;
  validator?: (val: T) => ValidatorResult<T>;
  prompt?: PromptFn<T>;
}

/** Overrides for a single .get() or .safeGet() call. */
export interface GetOptions<T> {
  /** Use this prompt for this call instead of the variable's prompt or callbacks.defaultPrompt. */
  prompt?: PromptFn<T>;
  /** Use this as the default for this call if no value from set/env/context. */
  default?: T;
}

export interface ScenvVariable<T> {
  get(options?: GetOptions<T>): Promise<T>;
  safeGet(options?: GetOptions<T>): Promise<
    { success: true; value: T } | { success: false; error?: unknown }
  >;
  save(value?: T): Promise<void>;
}

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
      return { raw: config.set[key], source: "set" };
    }
    if (!config.ignoreEnv) {
      log("trace", `resolveRaw: checking env ${envKey}`);
      const envVal = process.env[envKey];
      if (envVal !== undefined && envVal !== "") {
        log("trace", "resolveRaw: env hit");
        return { raw: envVal, source: "env" };
      }
    }
    if (!config.ignoreContext) {
      log("trace", "resolveRaw: checking context");
      const ctx = getContextValues();
      if (ctx[key] !== undefined) {
        log("trace", `resolveRaw: context hit key=${key}`);
        return { raw: ctx[key], source: "context" };
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
        raw !== undefined ? (raw as unknown as T) : effectiveDefault;
      value = (await Promise.resolve(fn(name, defaultForPrompt as T))) as T;
      wasPrompted = true;
      resolvedFrom = "prompt";
    } else if (raw !== undefined) {
      value = raw as unknown as T;
      resolvedFrom = source!;
    } else if (effectiveDefault !== undefined) {
      value = effectiveDefault;
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
      const shouldSavePrompt =
        config.shouldSavePrompt ?? (config.prompt === "never" ? "never" : "ask");
      const shouldAskSave =
        shouldSavePrompt === "always" || (shouldSavePrompt === "ask" && wasPrompted);
      if (shouldAskSave) {
        const callbacks = getCallbacks();
        if (typeof callbacks.onAskWhetherToSave !== "function") {
          throw new Error(
            `shouldSavePrompt is "${shouldSavePrompt}" but onAskWhetherToSave callback is not set. Configure callbacks via configure({ callbacks: { onAskWhetherToSave: ... } }).`
          );
        }
        const doSave = await callbacks.onAskWhetherToSave(name, final);
        if (!doSave) return final;
        const contextNames = config.contexts ?? [];
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
        config.contexts ?? []
      );
    }
    if (!contextName) contextName = config.contexts?.[0] ?? "default";
    writeToContext(contextName, key, String(validated.data));
    log("info", `Saved key=${key} to context ${contextName}`);
  }

  return { get, safeGet, save };
}

