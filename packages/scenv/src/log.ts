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

export function getLogLevel(): number {
  return getLevelNum();
}

let configLoadedLogged = false;

/** Reset internal log state (e.g. config-loaded guard). Useful in tests after resetConfig(). */
export function resetLogState(): void {
  configLoadedLogged = false;
}

export function logConfigLoaded(config: Pick<ScenvConfig, "root" | "contexts">): void {
  if (configLoadedLogged) return;
  if (getLevelNum() < LEVEL_NUM.info) return;
  configLoadedLogged = true;
  log(
    "info",
    "config loaded",
    "root=" + (config.root ?? "(cwd)"),
    "contexts=" + JSON.stringify(config.contexts ?? [])
  );
}

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
