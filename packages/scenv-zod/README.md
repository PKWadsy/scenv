# scenv-zod

Zod-based validator for [scenv](https://www.npmjs.com/package/scenv). Use Zod schemas to validate and coerce variable values (env/context/CLI are strings; use `z.coerce.number()`, etc.).

## Install

```bash
pnpm add scenv scenv-zod zod
# or
npm install scenv scenv-zod zod
```

**Peer dependencies:** `scenv`, `zod` (^3.22.0).

## Usage

Pass `validator(schema)` as the `validator` option to `scenv()`. The schema can coerce strings to numbers, booleans, etc.

```ts
import { scenv } from "scenv";
import { validator } from "scenv-zod";
import { z } from "zod";

const port = scenv("Port", {
  key: "port",
  env: "PORT",
  default: 3000,
  validator: validator(z.coerce.number().min(1).max(65535)),
});

const debug = scenv("Debug", {
  key: "debug",
  default: false,
  validator: validator(
    z.union([z.boolean(), z.literal("true"), z.literal("false")])
      .transform((v) => v === true || v === "true")
  ),
});

const portNum = await port.get();   // number
const isDebug = await debug.get();  // boolean
```

Validation runs during `.get()` / `.safeGet()`. On failure, `.get()` throws; `.safeGet()` returns `{ success: false, error }` with the Zod error.

## API

| Export | Description |
|--------|-------------|
| `validator(schema)` | Returns a function `(val: unknown) => { success: true, data } \| { success: false, error }` compatible with scenv’s `validator` option. |

## License

MIT
