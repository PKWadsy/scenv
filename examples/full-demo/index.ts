/**
 * Full-depth demo: config file, contexts, resolution order, validation, save, CLI.
 *
 * Run from repo root after pnpm build:
 *   cd examples/full-demo && pnpm start
 *
 * Try:
 *   pnpm run demo:default      # values from context files (dev then prod merge)
 *   pnpm run demo:cli-set      # --set overrides context/env
 *   pnpm run demo:env          # env vars override context
 *   pnpm run demo:contexts     # explicit --context dev,prod
 *   pnpm run demo:ignore-env   # --ignore-env so context wins
 *   pnpm run demo:save         # save a value to a context file
 */
import {
  configure,
  parseScenvArgs,
  loadConfig,
  scenv,
  getMergedContextValues,
  discoverContextPaths,
  getContextWritePath,
} from "scenv";
import { validator } from "scenv-zod";
import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// CLI and env are applied on top of scenv.config.json
configure(parseScenvArgs(process.argv.slice(2)));

const api_url = scenv("API URL", {
  key: "api_url",
  env: "API_URL",
  default: "http://localhost:4000",
});

const port = scenv("Port", {
  key: "port",
  env: "PORT",
  default: 3000,
  validator: validator(z.coerce.number().min(1).max(65535)),
});

const log_level = scenv("Log level", {
  key: "log_level",
  env: "LOG_LEVEL",
  default: "info",
  validator: (v) =>
    ["debug", "info", "warn", "error"].includes(String(v))
      ? true
      : { success: false, error: "invalid log level" },
});

const optional_feature = scenv("Optional feature flag", {
  key: "feature_beta",
  env: "FEATURE_BETA",
  default: "false",
});

async function main() {
  const config = loadConfig();
  const root = config.root ?? process.cwd();

  console.log("\n═══ scenv full demo ═══\n");

  console.log("── Config (file + env + CLI merge) ──");
  console.log("  root:", root);
  console.log("  context:", config.context?.join(", ") ?? "[]");
  console.log("  prompt:", config.prompt ?? "(default: fallback)");
  console.log("  ignoreEnv:", config.ignoreEnv ?? false);
  console.log("  ignoreContext:", config.ignoreContext ?? false);
  console.log("  set overrides:", config.set ? Object.keys(config.set) : "none");

  console.log("\n── Context discovery ──");
  const paths = discoverContextPaths(root);
  for (const [name, path] of paths) {
    console.log(`  ${name} → ${path}`);
  }

  console.log("\n── Merged context values (later context overwrites) ──");
  const ctxValues = getMergedContextValues();
  console.log("  ", ctxValues);

  console.log("\n── Resolved variables (--set > env > context > default) ──");
  const url = await api_url.get();
  const portVal = await port.get();
  const level = await log_level.get();
  const feature = await optional_feature.get();
  console.log("  api_url:", url);
  console.log("  port:", portVal, typeof portVal);
  console.log("  log_level:", level);
  console.log("  feature_beta:", feature);

  console.log("\n── safeGet() (no throw) ──");
  const missing = scenv("Required with no default", { key: "required_missing" });
  const result = await missing.safeGet();
  if (result.success) {
    console.log("  required_missing:", result.value);
  } else {
    console.log("  required_missing: failed (expected)", (result as { error?: unknown }).error instanceof Error ? (result as { error: Error }).error.message : "");
  }

  if (config.saveContextTo) {
    console.log("\n── Save to context ──");
    const toSave = scenv("Saved value", {
      key: "demo_saved_at",
      default: new Date().toISOString(),
    });
    await toSave.save();
    const savePath = getContextWritePath(config.saveContextTo);
    if (existsSync(savePath)) {
      const saved = JSON.parse(readFileSync(savePath, "utf-8"));
      console.log("  wrote to", config.saveContextTo + ".context.json");
      console.log("  contents:", saved);
    }
  }

  console.log("\n═══ done ═══\n");
}

main().catch(console.error);
