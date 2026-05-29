#!/usr/bin/env node
/**
 * Loads packages/oss/loop-engine-runtime-db/.env.local into process.env (if present),
 * then runs the Prisma CLI. CI / production deployments can omit the file and rely on
 * injected env vars. Self-host docker compose seeds the same vars from .env.compose.
 *
 * DDL (`migrate deploy`, `db push`) uses LOOP_ENGINE_DATABASE_MIGRATE_URL via schema `directUrl` —
 * set it explicitly for migration runs; falls back to LOOP_ENGINE_DATABASE_URL otherwise.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, "..");
const envPath = join(pkgRoot, ".env.local");

const RUNTIME_ENV_KEYS = ["LOOP_ENGINE_DATABASE_URL", "LOOP_ENGINE_DATABASE_MIGRATE_URL"];

function stripOuterQuotes(value) {
  let s = value.trim();
  const pairs = [
    ['"', '"'],
    ["'", "'"],
    ["\u201c", "\u201d"],
    ["\u2018", "\u2019"],
  ];
  for (let i = 0; i < 4; i++) {
    let changed = false;
    for (const [a, b] of pairs) {
      if (s.startsWith(a) && s.endsWith(b) && s.length >= a.length + b.length) {
        s = s.slice(a.length, -b.length);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return s.trim();
}

function sanitizeUrls() {
  for (const key of RUNTIME_ENV_KEYS) {
    const raw = process.env[key];
    if (raw === undefined) continue;
    let v = raw.replace(/^\uFEFF/, "").trim();
    v = stripOuterQuotes(v);
    process.env[key] = v;
    if (v.length === 0) {
      console.error(
        `[loop-engine-runtime-db] ${key} is set but empty after trim. Remove it or paste a full postgres:// URL.`,
      );
      process.exit(1);
    }
    if (!/^postgres(ql)?:\/\//i.test(v)) {
      console.error(
        `[loop-engine-runtime-db] ${key} must start with postgresql:// or postgres:// (got ${JSON.stringify(v.slice(0, 40))}…). ` +
          `Fix .env.local, or run \`unset ${key}\` if a stale shell export is overriding the file.`,
      );
      process.exit(1);
    }
  }

  if (!process.env.LOOP_ENGINE_DATABASE_MIGRATE_URL && process.env.LOOP_ENGINE_DATABASE_URL) {
    process.env.LOOP_ENGINE_DATABASE_MIGRATE_URL = process.env.LOOP_ENGINE_DATABASE_URL;
  }
}

if (existsSync(envPath)) {
  const { config } = await import("dotenv");
  config({ path: envPath, override: true });
}

sanitizeUrls();

const prismaBin = join(pkgRoot, "node_modules", ".bin", "prisma");
const args = process.argv.slice(2);
const result = spawnSync(prismaBin, args, {
  cwd: pkgRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
