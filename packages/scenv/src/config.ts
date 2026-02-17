import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type PromptMode = "always" | "never" | "fallback" | "no-env";
export type SavePromptMode = "always" | "never" | "ask";

export const LOG_LEVELS = ["none", "trace", "debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface ScenvConfig {
  /** Replace all contexts with this list (CLI: --context a,b,c) */
  contexts?: string[];
  /** Merge these contexts with existing (CLI: --add-context a,b,c) */
  addContexts?: string[];
  /** When to prompt for variable value */
  prompt?: PromptMode;
  /** Ignore environment variables during resolution */
  ignoreEnv?: boolean;
  /** Ignore loaded context during resolution */
  ignoreContext?: boolean;
  /** Override values: key -> string (CLI: --set key=val) */
  set?: Record<string, string>;
  /** When to ask "save for next time?" */
  savePrompt?: SavePromptMode;
  /** Where to save: context name or "ask" */
  saveContextTo?: "ask" | string;
  /** Root directory for config/context search (default: cwd) */
  root?: string;
  /** Log level: none (default), trace, debug, info, warn, error */
  logLevel?: LogLevel;
}

const CONFIG_FILENAME = "scenv.config.json";

const envKeyMap: Record<string, keyof ScenvConfig> = {
  SCENV_CONTEXT: "contexts",
  SCENV_ADD_CONTEXTS: "addContexts",
  SCENV_PROMPT: "prompt",
  SCENV_IGNORE_ENV: "ignoreEnv",
  SCENV_IGNORE_CONTEXT: "ignoreContext",
  SCENV_SAVE_PROMPT: "savePrompt",
  SCENV_SAVE_CONTEXT_TO: "saveContextTo",
  SCENV_LOG_LEVEL: "logLevel",
};

let programmaticConfig: Partial<ScenvConfig> = {};

/** (name, defaultValue) => value; used when a variable has no prompt option. Overridable per variable. */
export type DefaultPromptFn = (
  name: string,
  defaultValue: unknown
) => unknown | Promise<unknown>;

export interface ScenvCallbacks {
  /** Default prompt when a variable does not provide its own `prompt`. Variable's `prompt` overrides this. */
  defaultPrompt?: DefaultPromptFn;
  /** When user was just prompted for a value and savePrompt is ask/always: (variableName, value, contextNames) => context name to save to, or null to skip */
  onAskSaveAfterPrompt?: (
    name: string,
    value: unknown,
    contextNames: string[]
  ) => Promise<string | null>;
  /** When saveContextTo is "ask": (variableName, contextNames) => context name to save to */
  onAskContext?: (
    name: string,
    contextNames: string[]
  ) => Promise<string>;
}
let programmaticCallbacks: ScenvCallbacks = {};

export function getCallbacks(): ScenvCallbacks {
  return { ...programmaticCallbacks };
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
    if (configKey === "contexts" || configKey === "addContexts") {
      (out as Record<string, string[] | undefined>)[configKey] = val
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    } else if (configKey === "ignoreEnv" || configKey === "ignoreContext") {
      (out as Record<string, boolean>)[configKey] =
        val === "1" || val === "true" || val.toLowerCase() === "yes";
    } else if (configKey === "prompt" || configKey === "savePrompt") {
      const v = val.toLowerCase();
      if (
        configKey === "prompt" &&
        (v === "always" || v === "never" || v === "fallback" || v === "no-env")
      )
        (out as Record<string, PromptMode>)[configKey] = v as PromptMode;
      if (
        configKey === "savePrompt" &&
        (v === "always" || v === "never" || v === "ask")
      )
        (out as Record<string, SavePromptMode>)[configKey] = v as SavePromptMode;
    } else if (configKey === "saveContextTo") {
      out.saveContextTo = val;
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
    if (Array.isArray(parsed.contexts))
      out.contexts = parsed.contexts.filter(
        (x): x is string => typeof x === "string"
      );
    if (Array.isArray(parsed.addContexts))
      out.addContexts = parsed.addContexts.filter(
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
      typeof parsed.savePrompt === "string" &&
      ["always", "never", "ask"].includes(parsed.savePrompt)
    )
      out.savePrompt = parsed.savePrompt as SavePromptMode;
    if (typeof parsed.saveContextTo === "string")
      out.saveContextTo = parsed.saveContextTo;
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
 * Merge context lists: replace (contexts) wins over add (addContexts). Precedence: programmatic > env > file.
 */
function mergeContexts(
  fileConfig: Partial<ScenvConfig>,
  envConfig: Partial<ScenvConfig>,
  progConfig: Partial<ScenvConfig>
): string[] {
  const fromFile = fileConfig.contexts ?? fileConfig.addContexts ?? [];
  const fromEnvAdd = envConfig.addContexts ?? [];
  const fromEnvReplace = envConfig.contexts;
  const fromProgAdd = progConfig.addContexts ?? [];
  const fromProgReplace = progConfig.contexts;

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
 * Load full config: file (from root or cwd) <- env <- programmatic. Precedence: programmatic > env > file.
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

  merged.contexts = mergeContexts(fileConfig, envConfig, programmaticConfig);
  delete (merged as Partial<ScenvConfig>).addContexts;

  if (configDir && !merged.root) merged.root = configDir;
  else if (!merged.root) merged.root = startDir;

  return merged;
}

/**
 * Set programmatic config (e.g. from CLI flags). Merged on top of env and file in loadConfig().
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
 * Reset programmatic config (mainly for tests).
 */
export function resetConfig(): void {
  programmaticConfig = {};
  programmaticCallbacks = {};
}
