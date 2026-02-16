/**
 * Context merge order: later context overwrites earlier for the same key.
 * Base has database_url, cache_ttl, region. Overlay overrides database_url and cache_ttl, adds debug.
 *
 * Run:
 *   cd examples/contexts && pnpm start
 *   pnpm start -- --context overlay,base   (swap order: base wins where both set)
 */
import { configure, parseScenvArgs, loadConfig, scenv, getContextValues } from "scenv";

configure(parseScenvArgs(process.argv.slice(2)));

const database_url = scenv("Database URL", {
  key: "database_url",
  env: "DATABASE_URL",
  default: "postgres://default",
});

const cache_ttl = scenv("Cache TTL (seconds)", {
  key: "cache_ttl",
  default: "0",
});

const region = scenv("Region", {
  key: "region",
  default: "none",
});

const debug = scenv("Debug", {
  key: "debug",
  default: "false",
});

async function main() {
  const config = loadConfig();
  console.log("\nContext order:", config.contexts?.join(" → "));
  console.log("Merged context map:", getContextValues());
  console.log("");

  const db = await database_url.get();
  const ttl = await cache_ttl.get();
  const reg = await region.get();
  const dbg = await debug.get();

  console.log("Resolved:");
  console.log("  database_url:", db);
  console.log("  cache_ttl:", ttl);
  console.log("  region:", reg);
  console.log("  debug:", dbg);
  console.log("");
}

main().catch(console.error);
