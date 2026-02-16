import type { ScenvConfig } from "./config.js";

/**
 * Parse argv (e.g. process.argv.slice(2)) into ScenvConfig for configure().
 * Supports: --context a,b,c --add-context x,y --prompt fallback --ignore-env --ignore-context
 * --set key=value --save-prompt ask --save-context-to prod
 */
export function parseScenvArgs(argv: string[]): Partial<ScenvConfig> {
  const config: Partial<ScenvConfig> = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--context" && argv[i + 1] !== undefined) {
      config.contexts = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg === "--add-context" && argv[i + 1] !== undefined) {
      config.addContexts = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
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
    } else if (arg === "--save-prompt" && argv[i + 1] !== undefined) {
      const v = argv[++i].toLowerCase();
      if (["always", "never", "ask"].includes(v)) {
        config.savePrompt = v as ScenvConfig["savePrompt"];
      }
    } else if (arg === "--save-context-to" && argv[i + 1] !== undefined) {
      config.saveContextTo = argv[++i];
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
