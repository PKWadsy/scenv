#!/usr/bin/env node
/**
 * Build and publish all publishable packages. Authentication:
 * - If NPM_TOKEN is set (env or .env), uses it for publish.
 * - If not set (e.g. CI with npm trusted publisher / OIDC), npm will use OIDC.
 * Usage: node scripts/publish-npm.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");

function loadEnv() {
  if (process.env.NPM_TOKEN) return;
  const path = join(root, ".env");
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf-8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const npmrcPath = join(root, ".npmrc");

function main() {
  loadEnv();
  const useToken = !!process.env.NPM_TOKEN;
  if (useToken) {
    writeFileSync(npmrcPath, `//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}\n`);
  }
  try {
    run("pnpm", ["build"]);
    const publishArgs = ["-r", "publish", "--no-git-checks", "--access", "public"];
    if (dryRun) publishArgs.push("--dry-run");
    run("pnpm", publishArgs);
  } finally {
    if (useToken && existsSync(npmrcPath)) rmSync(npmrcPath);
  }
}

main();
