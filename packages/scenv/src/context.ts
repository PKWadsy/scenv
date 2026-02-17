import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { loadConfig } from "./config.js";
import { log, logConfigLoaded } from "./log.js";

const CONTEXT_SUFFIX = ".context.json";

function discoverContextPathsInternal(
  dir: string,
  found: Map<string, string>
): void {
  let entries: Array<{ name: string; path: string }>;
  try {
    entries = readdirSync(dir, { withFileTypes: true }).map((d) => ({
      name: d.name,
      path: join(dir, d.name),
    }));
  } catch {
    return;
  }
  for (const { name, path } of entries) {
    if (name.endsWith(CONTEXT_SUFFIX) && !name.startsWith(".")) {
      const contextName = name.slice(0, -CONTEXT_SUFFIX.length);
      if (!found.has(contextName)) found.set(contextName, path);
    }
  }
  for (const { name, path } of entries) {
    if (name === "." || name === "..") continue;
    try {
      if (statSync(path).isDirectory())
        discoverContextPathsInternal(path, found);
    } catch {
      // ignore
    }
  }
}

/**
 * Recursively discovers all `*.context.json` files under a directory. Context name is the
 * filename without the suffix (e.g. `dev.context.json` → "dev"). First file found for a
 * given name wins. Used internally for loading and saving; you can call it to inspect
 * available contexts.
 *
 * @param dir - Root directory to search (e.g. config.root or process.cwd()).
 * @param found - Optional existing map to merge results into. If omitted, a new Map is used.
 * @returns Map from context name to absolute file path.
 */
export function discoverContextPaths(
  dir: string,
  found: Map<string, string> = new Map()
): Map<string, string> {
  discoverContextPathsInternal(dir, found);
  log(
    "debug",
    "context discovery",
    "dir=" + dir,
    "found=" + JSON.stringify([...found.entries()].map(([n, p]) => ({ name: n, path: p })))
  );
  return found;
}

/**
 * Loads and merges context values from the current config. Respects {@link ScenvConfig.contexts}
 * order and {@link ScenvConfig.ignoreContext}. Each context file is a JSON object of string
 * key-value pairs; later contexts overwrite earlier for the same key. Used during variable
 * resolution (set > env > context > default).
 *
 * @returns A flat record of key → string value. Empty if ignoreContext is true or no contexts loaded.
 */
export function getContextValues(): Record<string, string> {
  const config = loadConfig();
  logConfigLoaded(config);
  if (config.ignoreContext) return {};
  const root = config.root ?? process.cwd();
  const paths = discoverContextPaths(root);
  const out: Record<string, string> = {};
  for (const contextName of config.contexts ?? []) {
    const filePath = paths.get(contextName);
    if (!filePath) {
      log("warn", `context "${contextName}" not found (no *.context.json)`);
      continue;
    }
    try {
      const raw = readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw) as Record<string, unknown>;
      const keys: string[] = [];
      for (const [k, v] of Object.entries(data)) {
        if (typeof v === "string") {
          out[k] = v;
          keys.push(k);
        }
      }
      log("debug", `context "${contextName}" loaded keys=${JSON.stringify(keys)}`);
    } catch (err) {
      log(
        "warn",
        `context "${contextName}" unreadable or invalid JSON: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return out;
}

/**
 * Returns the file path used for a context name when saving. If that context was already
 * discovered under config.root, returns its path; otherwise returns root/contextName.context.json.
 *
 * @param contextName - Name of the context (e.g. "dev", "prod").
 * @returns Absolute path to the context JSON file.
 */
export function getContextWritePath(contextName: string): string {
  const config = loadConfig();
  const root = config.root ?? process.cwd();
  const paths = discoverContextPaths(root);
  const existing = paths.get(contextName);
  if (existing) return existing;
  return join(root, `${contextName}${CONTEXT_SUFFIX}`);
}

/**
 * Writes a key-value pair into a context file. Merges with existing JSON; creates the file
 * and parent directory if needed. Used by variable.save() and when persisting prompted values.
 *
 * @param contextName - Name of the context (file will be contextName.context.json under config.root).
 * @param key - Variable key to write.
 * @param value - String value to store.
 */
export function writeToContext(
  contextName: string,
  key: string,
  value: string
): void {
  const path = getContextWritePath(contextName);
  let data: Record<string, string> = {};
  try {
    const raw = readFileSync(path, "utf-8");
    data = JSON.parse(raw) as Record<string, string>;
  } catch {
    // new file
  }
  data[key] = value;
  log("trace", "writeToContext", "path=" + path, "key=" + key);
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}
