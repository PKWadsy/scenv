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

/**
 * Internal: logs config loaded once per process when log level is info or higher.
 * @internal
 */
export function logConfigLoaded(config: Pick<ScenvConfig, "root" | "context">): void {
  if (configLoadedLogged) return;
  if (getLevelNum() < LEVEL_NUM.info) return;
  configLoadedLogged = true;
  log(
    "info",
    "config loaded",
    "root=" + (config.root ?? "(cwd)"),
    "context=" + JSON.stringify(config.context ?? [])
  );
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
