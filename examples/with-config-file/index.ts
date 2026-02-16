/**
 * Config is loaded from scenv.config.json in this directory (searched upward from cwd).
 * No programmatic configure() — everything comes from the config file (and env overlay).
 *
 * Run from this directory:
 *   cd examples/with-config-file && pnpm start
 *
 * Override with env:
 *   SCENV_PROMPT=never SCENV_ADD_CONTEXTS=extra pnpm start
 */
import { loadConfig, scenv } from "scenv";

async function main() {
  const config = loadConfig();
  console.log("\nLoaded from scenv.config.json (and env):");
  console.log("  root:", config.root);
  console.log("  contexts:", config.contexts);
  console.log("  prompt:", config.prompt);
  console.log("  ignoreEnv:", config.ignoreEnv);
  console.log("  savePrompt:", config.savePrompt);
  console.log("  saveContextTo:", config.saveContextTo);
  console.log("");

  const app_name = scenv("App name", {
    key: "app_name",
    default: "unknown",
  });
  const app_env = scenv("App env", {
    key: "app_env",
    default: "development",
  });

  console.log("Variables (from context or default):");
  console.log("  app_name:", await app_name.get());
  console.log("  app_env:", await app_env.get());
  console.log("");
}

main().catch(console.error);
