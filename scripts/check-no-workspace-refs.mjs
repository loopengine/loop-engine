#!/usr/bin/env node
/**
 * Ensures publish tarballs produced by `pnpm pack` contain no `workspace:` protocol refs.
 * Run after `pnpm build` — npm consumers must never see workspace:* in published manifests.
 *
 * @license Apache-2.0
 */
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packagesRoot = join(root, "packages");

/** @returns {string[]} */
function findPackageDirs(dir) {
  /** @type {string[]} */
  const out = [];
  function walk(d) {
    for (const name of readdirSync(d)) {
      if (name === "node_modules") continue;
      const p = join(d, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (!st.isDirectory()) continue;
      const pj = join(p, "package.json");
      if (existsSync(pj)) {
        out.push(p);
      } else {
        walk(p);
      }
    }
  }
  walk(dir);
  return out;
}

let failed = false;

for (const pkgDir of findPackageDirs(packagesRoot)) {
  const manifestPath = join(pkgDir, "package.json");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    continue;
  }
  if (manifest.private === true) continue;
  if (typeof manifest.name !== "string" || !manifest.name.startsWith("@loop-engine/")) continue;

  const tmpPack = mkdtempSync(join(tmpdir(), "le-pack-check-"));
  try {
    execSync(`pnpm pack --pack-destination "${tmpPack}"`, {
      cwd: pkgDir,
      stdio: "pipe",
      encoding: "utf8"
    });
    const tgz = readdirSync(tmpPack).find((f) => f.endsWith(".tgz"));
    if (!tgz) {
      console.error(`❌ ${manifest.name}: pnpm pack did not produce a .tgz`);
      failed = true;
      continue;
    }
    const unpack = mkdtempSync(join(tmpdir(), "le-unpack-"));
    try {
      execSync(`tar -xzf "${join(tmpPack, tgz)}" -C "${unpack}"`, { stdio: "pipe" });
      const published = JSON.parse(readFileSync(join(unpack, "package", "package.json"), "utf8"));
      const blob = JSON.stringify(published);
      if (blob.includes("workspace:")) {
        console.error(`❌ ${manifest.name}: packed manifest still contains "workspace:"`);
        console.error(published);
        failed = true;
      }
    } finally {
      rmSync(unpack, { recursive: true, force: true });
    }
  } catch (e) {
    console.error(`❌ ${manifest.name}: pack failed — ${e instanceof Error ? e.message : e}`);
    failed = true;
  } finally {
    rmSync(tmpPack, { recursive: true, force: true });
  }
}

if (failed) {
  console.error(
    "\nFix: publish with `pnpm publish -r` or `pnpm changeset publish` from the repo root (never `cd pkg && npm publish`)."
  );
  process.exit(1);
}

console.log("✅ Packed manifests contain no workspace: references.");
