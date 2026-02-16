/**
 * Using scenv with scenv-zod for validation. Values from env/context are strings;
 * z.coerce.number() (or similar) parses them.
 *
 * Run:
 *   pnpm install && pnpm start
 *   PORT=3001 pnpm start
 */
import { scenv } from "scenv";
import { validator } from "scenv-zod";
import { z } from "zod";

const port = scenv("Port", {
  key: "port",
  env: "PORT",
  default: 3000,
  validator: validator(z.coerce.number().min(1).max(65535)),
});

const debug = scenv("Debug mode", {
  key: "debug",
  default: false,
  validator: validator(
    z.union([
      z.literal("true"),
      z.literal("false"),
      z.boolean(),
    ]).transform((v) => v === true || v === "true")
  ),
});

async function main() {
  const p = await port.get();
  console.log("Port:", p, typeof p);

  const isDebug = await debug.get();
  console.log("Debug:", isDebug, typeof isDebug);
}

main().catch(console.error);
