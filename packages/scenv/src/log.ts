import { loadConfig } from "./config.js";
import type { LogLevel, ScenvConfig } from "./config.js";

const LEVEL_NUM: Record<LogLevel, number> = {
  none: -1,
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

function getLevelNum(): number {
  const config = loadConfig();
  const level = config.logLevel ?? "none";
  return LEVEL_NUM[level];
}

/**
 * Returns the numeric log level for the current config (for comparison). Higher = more verbose.
 * @returns -1 for "none", 0 trace, 1 debug, 2 info, 3 warn, 4 error.
 */
export function getLogLevel(): number {
  return getLevelNum();
}

let configLoadedLogged = false;

/**
 * Resets internal log state (e.g. the "config loaded" one-time guard). Call after
 * {@link resetConfig} in tests if you need to see config-loaded messages again or
 * assert on log output.
 */
export function resetLogState(): void {
  configLoadedLogged = false;
}

const CONFIG_LOG_KEYS: (keyof ScenvConfig)[] = [
  "root", "context", "prompt", "ignoreEnv", "ignoreContext",
  "set", "saveContextTo", "saveMode", "logLevel",
];

/** Serializes config for logging. Omits undefined; addContext is excluded (merged into context). */
function configForLog(config: ScenvConfig): Record<string, unknown> {
  return Object.fromEntries(
    CONFIG_LOG_KEYS.filter((k) => config[k] !== undefined).map((k) => [k, config[k]])
  );
}

/**
 * Internal: logs config loaded once per process. At debug level logs full effective config;
 * at info level logs key operational settings (root, context, prompt, save).
 * @internal
 */
export function logConfigLoaded(config: ScenvConfig): void {
  if (configLoadedLogged) return;
  configLoadedLogged = true;
  const levelNum = LEVEL_NUM[config.logLevel ?? "none"];

  if (levelNum >= LEVEL_NUM.info) {
    const parts: string[] = [
      "root=" + (config.root ?? "(cwd)"),
      "context=" + JSON.stringify(config.context ?? []),
    ];
    if (config.prompt !== undefined) parts.push("prompt=" + config.prompt);
    if (config.ignoreEnv === true) parts.push("ignoreEnv=true");
    if (config.ignoreContext === true) parts.push("ignoreContext=true");
    if (config.saveContextTo !== undefined) parts.push("saveContextTo=" + config.saveContextTo);
    if (config.saveMode !== undefined) parts.push("saveMode=" + config.saveMode);
    log("info", "config loaded", parts.join(" "));
  }

  if (levelNum >= LEVEL_NUM.debug) {
    log("debug", "config (full)", JSON.stringify(configForLog(config)));
  }
}

/**
 * Internal logger. Writes to stderr when config.logLevel is at or above the given level.
 * @internal
 */
export function log(
  level: Exclude<LogLevel, "none">,
  msg: string,
  ...args: unknown[]
): void {
  const configured = getLevelNum();
  if (configured < 0) return;
  if (LEVEL_NUM[level] < configured) return;
  const prefix = `[scenv] ${level}:`;
  if (args.length === 0) {
    console.error(prefix, msg);
  } else {
    console.error(prefix, msg, ...args);
  }
}
