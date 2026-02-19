import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { join, dirname, isAbsolute, sep } from "node:path";
import { loadConfig } from "./config.js";
import { log, logConfigLoaded } from "./log.js";

const CONTEXT_SUFFIX = ".context.json";

/** In-memory context: values resolved or saved during this process. Checked before file contexts so .get() on same variable twice does not prompt twice. */
let inMemoryContext: Record<string, string> = {};

/**
 * Returns the current in-memory context (key → value). Used during resolution before file contexts.
 * Modifying the returned object mutates the store.
 */
export function getInMemoryContext(): Record<string, string> {
  return inMemoryContext;
}

/**
 * Sets a key-value pair in the in-memory context. Used when saving after prompt or save() when saveContextTo is unset, and always updated when a value is saved so the next get() sees it.
 */
export function setInMemoryContext(key: string, value: string): void {
  inMemoryContext[key] = value;
}

/**
 * Clears the in-memory context. Mainly for tests. Call in beforeEach to get a clean slate.
 */
export function resetInMemoryContext(): void {
  inMemoryContext = {};
}

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
 * Loads key-value pairs from a single context file. Used when resolving @context:key references.
 * Does not depend on config.context or ignoreContext; the context file is read if it exists
 * under the search directory.
 *
 * @param contextName - Name of the context (e.g. "prod", "dev") — file is contextName.context.json.
 * @param root - Optional directory to search. If omitted, searches from process.cwd() then from project root (config.root) if the context is not found under cwd.
 * @returns A flat record of key → string value from that context file. Empty if file not found or invalid.
 */
export function getContext(
  contextName: string,
  root?: string
): Record<string, string> {
  let filePath: string | undefined;
  if (root !== undefined) {
    const paths = discoverContextPaths(root);
    filePath = paths.get(contextName);
  } else {
    const cwd = process.cwd();
    const paths = discoverContextPaths(cwd);
    filePath = paths.get(contextName);
    if (!filePath) {
      const config = loadConfig();
      const projectRoot = config.root ?? cwd;
      if (projectRoot !== cwd) {
        const rootPaths = discoverContextPaths(projectRoot);
        filePath = rootPaths.get(contextName);
      }
    }
  }
  if (!filePath) {
    log("trace", `getContext: context "${contextName}" not found`);
    return {};
  }
  try {
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch (err) {
    log(
      "trace",
      `getContext: "${contextName}" unreadable: ${err instanceof Error ? err.message : String(err)}`
    );
    return {};
  }
}

/**
 * Loads and merges context values from the current config from {@link ScenvConfig.context} only.
 * saveContextTo is not used for resolution; it is only a write target. To use the same context
 * for reading, add it explicitly via context or addContext.
 * Respects {@link ScenvConfig.ignoreContext}. Later contexts overwrite earlier for the same key.
 * Used during variable resolution (set > env > in-memory > merged context > default).
 *
 * @returns A flat record of key → string value. Empty if ignoreContext is true or no context loaded.
 */
export function getMergedContextValues(): Record<string, string> {
  const config = loadConfig();
  logConfigLoaded(config);
  if (config.ignoreContext) return {};
  const searchRoot = process.cwd();
  const paths = discoverContextPaths(searchRoot);
  const out: Record<string, string> = {};
  for (const contextName of config.context ?? []) {
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
 * Returns the file path used for a context name or path when saving.
 * - If contextName is path-like (absolute or contains path separator), returns that path with .context.json appended if not already present.
 * - Otherwise, if that context was already discovered under cwd, returns its path; else saves under project root (config.root or cwd).
 *
 * @param contextName - Context name (e.g. "dev", "prod") or file path without suffix (e.g. "/path/to/myfile" → myfile.context.json).
 * @returns Absolute path to the context JSON file.
 */
export function getContextWritePath(contextName: string): string {
  if (isAbsolute(contextName) || contextName.includes(sep)) {
    return contextName.endsWith(CONTEXT_SUFFIX)
      ? contextName
      : contextName + CONTEXT_SUFFIX;
  }
  const config = loadConfig();
  const paths = discoverContextPaths(process.cwd());
  const existing = paths.get(contextName);
  if (existing) return existing;
  const projectRoot = config.root ?? process.cwd();
  return join(projectRoot, `${contextName}${CONTEXT_SUFFIX}`);
}

/**
 * Resolves saveContextTo to an absolute file path. Path-like values get .context.json appended; context names use getContextWritePath.
 */
export function resolveSaveContextPath(nameOrPath: string): string {
  if (isAbsolute(nameOrPath) || nameOrPath.includes(sep)) {
    return nameOrPath.endsWith(CONTEXT_SUFFIX)
      ? nameOrPath
      : nameOrPath + CONTEXT_SUFFIX;
  }
  return getContextWritePath(nameOrPath);
}

/**
 * Loads key-value pairs from a context file at the given path. Returns empty object if file does not exist or is invalid.
 */
export function getContextAtPath(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  try {
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
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
