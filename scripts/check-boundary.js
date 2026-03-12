#!/usr/bin/env node
/**
 * Compatibility entrypoint for environments that invoke:
 *   node scripts/check-boundary.js
 * The canonical implementation lives in check-boundary.ts.
 */
const { spawnSync } = require("node:child_process");

const result = spawnSync("pnpm", ["exec", "tsx", "scripts/check-boundary.ts"], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
