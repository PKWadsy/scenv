# Senv examples

Each example is a small runnable app. From the repo root, install, build packages, and run:

```bash
pnpm install
pnpm build
cd examples/basic && pnpm start
```

## Examples

| Example | Description |
|--------|-------------|
| **basic** | Simple variable with default and env; `get()` and `safeGet()`. |
| **with-zod** | Validation with `senv-zod` and Zod schemas (e.g. port number, boolean). |
| **cli-integration** | Parse CLI flags with `parseSenvArgs()` and `configure()` so variables respect `--set`, `--prompt`, `--context`, etc. |

## Running with overrides

- **Env:** `API_URL=https://prod.example.com pnpm start` (in `examples/cli-integration` or any example that uses that key).
- **CLI:** `pnpm start -- --set api_url=https://custom.com` (in `examples/cli-integration`).
