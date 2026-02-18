import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  defaultPrompt as defaultPromptFn,
  defaultAskWhetherToSave,
  defaultAskContext,
} from "./prompt-default.js";

/**
 * When to prompt the user for a variable value during resolution.
 * - `"always"` – Always call the variable's prompt (or defaultPrompt) when resolving.
 * - `"never"` – Never prompt; use set/env/context/default only.
 * - `"fallback"` – Prompt only when no value was found from set, env, or context.
 * - `"no-env"` – Prompt when the env var is not set (even if context has a value).
 */
export type PromptMode = "always" | "never" | "fallback" | "no-env";

/**
 * What to do with the value after the user was just prompted for it.
 * - `"never"` – Do not save; discard for next time.
 * - `"always"` – Save it (no prompt). Use saveContextTo or onAskContext only to pick where.
 * - `"ask"` – Call {@link ScenvCallbacks.onAskWhetherToSave}; if true save, if false don't save.
 */
export type SavePromptMode = "always" | "never" | "ask";

/**
 * Valid log levels. Use with {@link ScenvConfig.logLevel}.
 * Messages at or above the configured level are written to stderr.
 */
export const LOG_LEVELS = ["none", "trace", "debug", "info", "warn", "error"] as const;

/** Log level type. `"none"` disables logging; higher values are more verbose. */
export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * Full scenv configuration. Built from file (scenv.config.json), environment (SCENV_*),
 * and programmatic config (configure()), with programmatic > env > file precedence.
 * All properties are optional; defaults apply when omitted.
 */
export interface ScenvConfig {
  /** Replace the context list entirely (CLI: `--context a,b,c`). Loaded in order; later overwrites earlier for same key. */
  context?: string[];
  /** Merge these context names with existing (CLI: `--add-context a,b,c`). Ignored if `context` is set in the same layer. */
  addContext?: string[];
  /** When to prompt for a variable value. See {@link PromptMode}. Default is `"fallback"`. */
  prompt?: PromptMode;
  /** If true, environment variables are not used during resolution. */
  ignoreEnv?: boolean;
  /** If true, context files are not loaded during resolution. */
  ignoreContext?: boolean;
  /** Override values by key (CLI: `--set key=value`). Takes precedence over env and context. */
  set?: Record<string, string>;
  /** After a prompt: "never" = don't save, "always" = save without asking, "ask" = call onAskWhetherToSave (then save if true). */
  shouldSavePrompt?: SavePromptMode;
  /** Target context for saving: a context name, or `"ask"` to use {@link ScenvCallbacks.onAskContext}. */
  saveContextTo?: "ask" | string;
  /** Directory to save context files to when the context is not already discovered. Relative to root unless absolute. If unset, new context files are saved under root. */
  contextDir?: string;
  /** Root directory for config file search and context discovery. Default is cwd or the directory containing scenv.config.json. */
  root?: string;
  /** Logging level. Default is `"none"`. Messages go to stderr. */
  logLevel?: LogLevel;
}

const CONFIG_FILENAME = "scenv.config.json";

const envKeyMap: Record<string, keyof ScenvConfig> = {
  SCENV_CONTEXT: "context",
  SCENV_ADD_CONTEXT: "addContext",
  SCENV_PROMPT: "prompt",
  SCENV_IGNORE_ENV: "ignoreEnv",
  SCENV_IGNORE_CONTEXT: "ignoreContext",
  SCENV_SAVE_PROMPT: "shouldSavePrompt",
  SCENV_SAVE_CONTEXT_TO: "saveContextTo",
  SCENV_CONTEXT_DIR: "contextDir",
  SCENV_LOG_LEVEL: "logLevel",
};

let programmaticConfig: Partial<ScenvConfig> = {};

/**
 * Default prompt function signature. Called when a variable has no `prompt` option and
 * config requests prompting. Receives the variable's display name and default value;
 * returns the value to use (sync or async). Overridable per variable via the variable's
 * `prompt` option or per call via get({ prompt: fn }).
 */
export type DefaultPromptFn = (
  name: string,
  defaultValue: unknown
) => unknown | Promise<unknown>;

/**
 * Callbacks for interactive behaviour. All have built-in readline defaults when not set.
 * Pass to {@link configure} via `configure({ callbacks: { ... } })`.
 */
export interface ScenvCallbacks {
  /** Used when a variable does not define its own `prompt`. Variable-level `prompt` overrides this. */
  defaultPrompt?: DefaultPromptFn;
  /** Called only when {@link ScenvConfig.shouldSavePrompt} is "ask" and the user was just prompted. Return true to save, false to skip. (With "always", we save without calling this.) */
  onAskWhetherToSave?: (
    name: string,
    value: unknown
  ) => Promise<boolean>;
  /** Called when the save destination is ambiguous: saveContextTo is "ask", or after a prompt when the user said yes and saveContextTo is "ask". Return the context name to write to. */
  onAskContext?: (
    name: string,
    contextNames: string[]
  ) => Promise<string>;
}
let programmaticCallbacks: ScenvCallbacks = {};

/**
 * Returns the current callbacks (with built-in defaults merged in for any unset callback).
 * Useful for inspection or to pass a subset to another layer. Each call returns a new object.
 *
 * @returns Copy of the effective callbacks: defaultPrompt, onAskWhetherToSave, onAskContext (always defined).
 */
export function getCallbacks(): ScenvCallbacks {
  return {
    defaultPrompt: programmaticCallbacks.defaultPrompt ?? defaultPromptFn,
    onAskWhetherToSave:
      programmaticCallbacks.onAskWhetherToSave ?? defaultAskWhetherToSave,
    onAskContext: programmaticCallbacks.onAskContext ?? defaultAskContext,
  };
}

/**
 * Find scenv.config.json by searching upward from dir.
 */
function findConfigDir(startDir: string): string | null {
  let dir = startDir;
  const root = dirname(dir);
  for (;;) {
    const candidate = join(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) return dir;
    if (dir === root) break;
    dir = dirname(dir);
  }
  return null;
}

/**
 * Load config from process.env (SCENV_*). Values are strings; we coerce booleans and pass through strings.
 */
function configFromEnv(): Partial<ScenvConfig> {
  const out: Partial<ScenvConfig> = {};
  for (const [envKey, configKey] of Object.entries(envKeyMap)) {
    const val = process.env[envKey];
    if (val === undefined || val === "") continue;
    if (configKey === "context" || configKey === "addContext") {
      (out as Record<string, string[] | undefined>)[configKey] = val
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    } else if (configKey === "ignoreEnv" || configKey === "ignoreContext") {
      (out as Record<string, boolean>)[configKey] =
        val === "1" || val === "true" || val.toLowerCase() === "yes";
    } else if (configKey === "prompt" || configKey === "shouldSavePrompt") {
      const v = val.toLowerCase();
      if (
        configKey === "prompt" &&
        (v === "always" || v === "never" || v === "fallback" || v === "no-env")
      )
        (out as Record<string, PromptMode>)[configKey] = v as PromptMode;
      if (
        configKey === "shouldSavePrompt" &&
        (v === "always" || v === "never" || v === "ask")
      )
        (out as Record<string, SavePromptMode>)[configKey] = v as SavePromptMode;
    } else if (configKey === "saveContextTo") {
      out.saveContextTo = val;
    } else if (configKey === "contextDir") {
      out.contextDir = val;
    } else if (configKey === "logLevel") {
      const v = val.toLowerCase();
      if (LOG_LEVELS.includes(v as LogLevel)) out.logLevel = v as LogLevel;
    }
  }
  return out;
}

/**
 * Load scenv.config.json from the given directory. Returns partial config or {}.
 */
function loadConfigFile(configDir: string): Partial<ScenvConfig> {
  const path = join(configDir, CONFIG_FILENAME);
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<ScenvConfig> = {};
    if (Array.isArray(parsed.context))
      out.context = parsed.context.filter(
        (x): x is string => typeof x === "string"
      );
    else if (Array.isArray(parsed.contexts))
      out.context = parsed.contexts.filter(
        (x): x is string => typeof x === "string"
      );
    if (Array.isArray(parsed.addContext))
      out.addContext = parsed.addContext.filter(
        (x): x is string => typeof x === "string"
      );
    else if (Array.isArray(parsed.addContexts))
      out.addContext = parsed.addContexts.filter(
        (x): x is string => typeof x === "string"
      );
    if (
      typeof parsed.prompt === "string" &&
      ["always", "never", "fallback", "no-env"].includes(parsed.prompt)
    )
      out.prompt = parsed.prompt as PromptMode;
    if (typeof parsed.ignoreEnv === "boolean") out.ignoreEnv = parsed.ignoreEnv;
    if (typeof parsed.ignoreContext === "boolean")
      out.ignoreContext = parsed.ignoreContext;
    if (parsed.set && typeof parsed.set === "object" && !Array.isArray(parsed.set))
      out.set = parsed.set as Record<string, string>;
    if (
      typeof (parsed.shouldSavePrompt ?? parsed.savePrompt) === "string" &&
      ["always", "never", "ask"].includes((parsed.shouldSavePrompt ?? parsed.savePrompt) as string)
    )
      out.shouldSavePrompt = (parsed.shouldSavePrompt ?? parsed.savePrompt) as SavePromptMode;
    if (typeof parsed.saveContextTo === "string")
      out.saveContextTo = parsed.saveContextTo;
    if (typeof parsed.contextDir === "string") out.contextDir = parsed.contextDir;
    else if (typeof parsed.contextsDir === "string") out.contextDir = parsed.contextsDir;
    if (typeof parsed.root === "string") out.root = parsed.root;
    if (
      typeof parsed.logLevel === "string" &&
      LOG_LEVELS.includes(parsed.logLevel as LogLevel)
    )
      out.logLevel = parsed.logLevel as LogLevel;
    return out;
  } catch (err) {
    const envLevel = process.env.SCENV_LOG_LEVEL?.toLowerCase();
    if (
      envLevel &&
      envLevel !== "none" &&
      ["trace", "debug", "info", "warn", "error"].includes(envLevel)
    ) {
      console.error(
        `[scenv] error: failed to parse ${path}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return {};
  }
}

/**
 * Merge context lists: replace (context) wins over add (addContext). Precedence: programmatic > env > file.
 */
function mergeContexts(
  fileConfig: Partial<ScenvConfig>,
  envConfig: Partial<ScenvConfig>,
  progConfig: Partial<ScenvConfig>
): string[] {
  const fromFile = fileConfig.context ?? fileConfig.addContext ?? [];
  const fromEnvAdd = envConfig.addContext ?? [];
  const fromEnvReplace = envConfig.context;
  const fromProgAdd = progConfig.addContext ?? [];
  const fromProgReplace = progConfig.context;

  const replace = fromProgReplace ?? fromEnvReplace;
  if (replace !== undefined) return replace;
  const base = [...fromFile];
  const add = [...fromEnvAdd, ...fromProgAdd];
  const seen = new Set(base);
  for (const c of add) {
    if (!seen.has(c)) {
      seen.add(c);
      base.push(c);
    }
  }
  return base;
}

/**
 * Loads the full merged configuration. Searches for scenv.config.json upward from the given
 * root (or cwd / programmatic root), then overlays SCENV_* env vars, then programmatic config.
 * Use this to read the effective config (e.g. for logging or conditional logic).
 *
 * @param root - Optional directory to start searching for scenv.config.json. If omitted, uses programmatic config.root or process.cwd().
 * @returns The merged {@link ScenvConfig} with at least `root` and `context` defined.
 */
export function loadConfig(root?: string): ScenvConfig {
  const startDir =
    root ?? programmaticConfig.root ?? process.cwd();
  const configDir = findConfigDir(startDir);
  const fileConfig = configDir ? loadConfigFile(configDir) : {};
  const envConfig = configFromEnv();

  const merged: ScenvConfig = {
    ...fileConfig,
    ...envConfig,
    ...programmaticConfig,
  };

  merged.context = mergeContexts(fileConfig, envConfig, programmaticConfig);
  delete (merged as Partial<ScenvConfig>).addContext;

  if (configDir && !merged.root) merged.root = configDir;
  else if (!merged.root) merged.root = startDir;

  return merged;
}

/**
 * Merges config and/or callbacks into the programmatic layer. Programmatic config has
 * highest precedence in {@link loadConfig}. Call multiple times to merge; later values
 * overwrite earlier for the same key. Typical use: pass the result of {@link parseScenvArgs}
 * or your own partial config.
 *
 * @param partial - Partial config and/or `callbacks`. Omitted keys are left unchanged. Nested objects (e.g. callbacks, set) are merged shallowly with existing.
 */
export function configure(
  partial: Partial<ScenvConfig> & { callbacks?: ScenvCallbacks }
): void {
  const { callbacks, ...configPartial } = partial;
  programmaticConfig = { ...programmaticConfig, ...configPartial };
  if (callbacks) {
    programmaticCallbacks = { ...programmaticCallbacks, ...callbacks };
  }
}

/**
 * Clears all programmatic config and callbacks. File and env config are unaffected.
 * Mainly for tests. After calling, the next loadConfig() will not include any programmatic overrides.
 */
export function resetConfig(): void {
  programmaticConfig = {};
  programmaticCallbacks = {};
}
