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
 * Recursively find all *.context.json files under dir. Returns map: contextName -> absolute path (first found wins).
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
 * Load context files in the order of config.contexts; merge into one flat map (later context overwrites earlier for same key).
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
 * Get the path for a context name (for saving). If already discovered, returns that path; otherwise returns path for new file under root.
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
 * Write key=value into a context file (merge with existing, create file if needed).
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
