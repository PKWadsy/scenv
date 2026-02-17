/// <reference types="node" />
/**
 * Integrate scenv with your app's CLI: parse argv and pass to configure().
 * Then variables respect --set, --prompt, --context, etc.
 *
 * Run:
 *   pnpm install && pnpm start
 *   pnpm start:with-args
 *   pnpm start -- --context prod --set api_url=https://api.prod.com
 */
import { configure, parseScenvArgs, scenv } from "scenv";

// Pass through CLI args (e.g. process.argv.slice(2) from your app)
configure(parseScenvArgs(process.argv.slice(2)));

const api_url = scenv("API URL", {
  key: "api_url",
  env: "API_URL",
});

async function main() {
  const url = await api_url.get();
  console.log("API URL:", url);
}

main().catch(console.error);
