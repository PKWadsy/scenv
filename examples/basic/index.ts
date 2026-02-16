/**
 * Basic senv usage: define a variable with a default and optional key/env.
 * Resolution order: --set > env > context > default.
 *
 * Run:
 *   pnpm install && pnpm start
 *   CORE_SERVER_URL=https://prod.example.com pnpm start
 */
import { senv } from "senv";

const core_server_url = senv("Core Server URL", {
  key: "core_server_url",
  env: "CORE_SERVER_URL",
  default: "localhost:7000",
});

async function main() {
  const url = await core_server_url.get();
  console.log("Core Server URL:", url);

  const result = await core_server_url.safeGet();
  if (result.success) {
    console.log("safeGet() value:", result.value);
  }
}

main().catch(console.error);
