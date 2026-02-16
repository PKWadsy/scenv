/**
 * Save flow: variable.save(), saveContextTo, and callbacks (onAskContext, onAskSaveAfterPrompt).
 * Runs non-interactively by providing callbacks that return fixed values.
 *
 * Run: cd examples/save-flow && pnpm start
 */
import {
  configure,
  scenv,
  getCallbacks,
} from "scenv";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

configure({
  root: __dirname,
  contexts: ["saved"],
  prompt: "never",
  saveContextTo: "ask",
  callbacks: {
    onAskContext: async (variableName, contextNames) => {
      console.log("  [callback] onAskContext called:", { variableName, contextNames });
      return "saved";
    },
    onAskSaveAfterPrompt: async (variableName, value, contextNames) => {
      console.log("  [callback] onAskSaveAfterPrompt called:", { variableName, value, contextNames });
      return "saved";
    },
  },
});

async function main() {
  console.log("\n── Save with saveContextTo: ask (onAskContext) ──");
  const toSave = scenv("Token", {
    key: "api_token",
    default: "demo-token-123",
  });
  await toSave.save();
  const path = join(__dirname, "saved.context.json");
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
  console.log("  onAskContext:", typeof cb.onAskContext);
  console.log("  onAskSaveAfterPrompt:", typeof cb.onAskSaveAfterPrompt);
  console.log("");
}

main().catch(console.error);
