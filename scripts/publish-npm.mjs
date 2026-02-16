#!/usr/bin/env node
/**
 * Load NPM_TOKEN from .env, then build and publish all publishable packages.
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
  const path = join(root, ".env");
  if (!existsSync(path)) {
    console.error("Missing .env file in repo root. Add NPM_TOKEN=...");
    process.exit(1);
  }
  const raw = readFileSync(path, "utf-8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
  if (!process.env.NPM_TOKEN) {
    console.error("NPM_TOKEN not set in .env");
    process.exit(1);
  }
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const npmrcPath = join(root, ".npmrc");
const npmrcContent = `//registry.npmjs.org/:_authToken=\${NPM_TOKEN}\n`;

function main() {
  loadEnv();
  writeFileSync(npmrcPath, `//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}\n`);
  try {
    run("pnpm", ["build"]);
    const publishArgs = ["-r", "publish", "--no-git-checks", "--access", "public"];
    if (dryRun) publishArgs.push("--dry-run");
    run("pnpm", publishArgs);
  } finally {
    if (existsSync(npmrcPath)) rmSync(npmrcPath);
  }
}

main();
