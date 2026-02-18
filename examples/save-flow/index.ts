/**
 * Save flow: variable.save(), saveContextTo (path or context name).
 * Values are always stored in-memory; when saveContextTo is set they are also written to that file.
 *
 * Run: cd examples/save-flow && pnpm start
 */
import {
  configure,
  scenv,
  getCallbacks,
  getContextWritePath,
} from "scenv";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

configure({
  root: __dirname,
  context: ["saved"],
  prompt: "never",
  saveContextTo: "saved",
});

async function main() {
  console.log("\n── Save with saveContextTo: saved ──");
  const toSave = scenv("Token", {
    key: "api_token",
    default: "demo-token-123",
  });
  await toSave.save();
  const path = getContextWritePath("saved");
  if (existsSync(path)) {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    console.log("  Written to saved.context.json:", data);
  }

  console.log("\n── save(value) with explicit value ──");
  const other = scenv("Other", { key: "other_key", default: "default" });
  await other.save("explicit-value");
  if (existsSync(path)) {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    console.log("  saved.context.json now:", data);
  }

  console.log("\n── Callbacks (getCallbacks) ──");
  const cb = getCallbacks();
  console.log("  defaultPrompt:", typeof cb.defaultPrompt);
  console.log("");
}

main().catch(console.error);
