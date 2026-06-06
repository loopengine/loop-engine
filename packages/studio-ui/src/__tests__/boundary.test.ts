// SPDX-License-Identifier: Apache-2.0
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN = [
  "@betterdata/database-loops",
  "@repo/database",
  "prisma",
  "fetch(",
  "axios",
] as const;

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "__tests__") continue;
      walk(full, files);
    } else if (/\.(tsx?|css)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

describe("studio-ui package boundary (RT-06)", () => {
  it("does not import database or network clients", () => {
    const violations: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const content = readFileSync(file, "utf8");
      for (const needle of FORBIDDEN) {
        if (content.includes(needle)) {
          violations.push(`${path.relative(SRC_ROOT, file)}: ${needle}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
