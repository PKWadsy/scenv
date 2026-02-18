import type { ScenvConfig } from "./config.js";
import { LOG_LEVELS, type LogLevel } from "./config.js";

/**
 * Parses command-line arguments into a partial {@link ScenvConfig} suitable for {@link configure}.
 * Typical use: `configure(parseScenvArgs(process.argv.slice(2)))`. Unrecognized flags are ignored.
 *
 * Supported flags:
 * - `--context a,b,c` – Set context list (replace).
 * - `--add-context x,y` – Add context names.
 * - `--prompt always|never|fallback|no-env` – Prompt mode.
 * - `--ignore-env` – Set ignoreEnv to true.
 * - `--ignore-context` – Set ignoreContext to true.
 * - `--set key=value` or `--set=key=value` – Add to set overrides (multiple allowed).
 * - `--save-context-to pathOrName` – saveContextTo (path or context name without .context.json).
 * - `--context-dir path` – contextDir (directory to save context files to by default).
 * - `--log-level level`, `--log level`, `--log=level` – logLevel.
 *
 * @param argv - Array of CLI arguments (e.g. process.argv.slice(2)).
 * @returns Partial ScenvConfig with only the keys that were present in argv.
 */
export function parseScenvArgs(argv: string[]): Partial<ScenvConfig> {
  const config: Partial<ScenvConfig> = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--context" && argv[i + 1] !== undefined) {
      config.context = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg === "--add-context" && argv[i + 1] !== undefined) {
      config.addContext = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg === "--prompt" && argv[i + 1] !== undefined) {
      const v = argv[++i].toLowerCase();
      if (["always", "never", "fallback", "no-env"].includes(v)) {
        config.prompt = v as ScenvConfig["prompt"];
      }
    } else if (arg === "--ignore-env") {
      config.ignoreEnv = true;
    } else if (arg === "--ignore-context") {
      config.ignoreContext = true;
    } else if (arg === "--set" && argv[i + 1] !== undefined) {
      const pair = argv[++i];
      const eq = pair.indexOf("=");
      if (eq > 0) {
        config.set = config.set ?? {};
        config.set[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
      }
    } else if (arg === "--save-context-to" && argv[i + 1] !== undefined) {
      config.saveContextTo = argv[++i];
    } else if (arg === "--context-dir" && argv[i + 1] !== undefined) {
      config.contextDir = argv[++i];
    } else if ((arg === "--log-level" || arg === "--log") && argv[i + 1] !== undefined) {
      const v = argv[++i].toLowerCase() as LogLevel;
      if (LOG_LEVELS.includes(v)) {
        config.logLevel = v;
      }
    } else if (arg.startsWith("--log=")) {
      const v = arg.slice(6).toLowerCase() as LogLevel;
      if (LOG_LEVELS.includes(v)) {
        config.logLevel = v;
      }
    } else if (arg.startsWith("--set=")) {
      const pair = arg.slice(6);
      const eq = pair.indexOf("=");
      if (eq > 0) {
        config.set = config.set ?? {};
        config.set[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
      }
    }
    i++;
  }
  return config;
}
