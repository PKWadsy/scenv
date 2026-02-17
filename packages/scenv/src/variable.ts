import { loadConfig, getCallbacks } from "./config.js";
import { getContextValues, writeToContext } from "./context.js";
import { defaultPrompt } from "./prompt-default.js";

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

  async function resolveRaw(): Promise<string | undefined> {
    const config = loadConfig();
    if (config.set?.[key] !== undefined) return config.set[key];
    if (!config.ignoreEnv) {
      const envVal = process.env[envKey];
      if (envVal !== undefined && envVal !== "") return envVal;
    }
    if (!config.ignoreContext) {
      const ctx = getContextValues();
      if (ctx[key] !== undefined) return ctx[key];
    }
    return undefined;
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
    const raw = await resolveRaw();
    const hadEnv =
      !config.ignoreEnv &&
      process.env[envKey] !== undefined &&
      process.env[envKey] !== "";
    const hadValue = raw !== undefined;
    const effectiveDefault = overrides?.default !== undefined ? overrides.default : defaultValue;
    let wasPrompted = false;
    let value: T;
    if (shouldPrompt(config, hadValue, hadEnv)) {
      const defaultForPrompt =
        raw !== undefined ? (raw as unknown as T) : effectiveDefault;
      const callbacks = getCallbacks();
      const fn =
        overrides?.prompt ?? promptFn ?? callbacks.defaultPrompt ?? defaultPrompt;
      value = (await Promise.resolve(fn(name, defaultForPrompt as T))) as T;
      wasPrompted = true;
    } else if (raw !== undefined) {
      value = raw as unknown as T;
    } else if (effectiveDefault !== undefined) {
      value = effectiveDefault;
    } else {
      throw new Error(`Missing value for variable "${name}" (key: ${key})`);
    }
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
      throw new Error(
        `Validation failed for "${name}": ${validated.error ?? "unknown"}`
      );
    }
    const final = validated.data;
    if (wasPrompted) {
      const config = loadConfig();
      const savePrompt = config.savePrompt ?? "never";
      const shouldAskSave =
        savePrompt === "always" || (savePrompt === "ask" && wasPrompted);
      if (shouldAskSave) {
        const callbacks = getCallbacks();
        const ctxToSave =
          callbacks.onAskSaveAfterPrompt &&
          (await callbacks.onAskSaveAfterPrompt(
            name,
            final,
            config.contexts ?? []
          ));
        if (ctxToSave) writeToContext(ctxToSave, key, String(final));
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
      throw new Error(
        `Validation failed for "${name}": ${validated.error ?? "unknown"}`
      );
    }
    const config = loadConfig();
    let contextName: string | undefined = config.saveContextTo;
    if (contextName === "ask") {
      const callbacks = getCallbacks();
      if (typeof callbacks.onAskContext === "function") {
        contextName = await callbacks.onAskContext(
          name,
          config.contexts ?? []
        );
      } else {
        contextName = config.contexts?.[0] ?? "default";
      }
    }
    if (!contextName) contextName = config.contexts?.[0] ?? "default";
    writeToContext(contextName, key, String(validated.data));
  }

  return { get, safeGet, save };
}

