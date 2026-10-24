// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseLoopYaml } from "../parser";

function yamlFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...yamlFiles(full));
    } else if (entry.endsWith(".yaml")) {
      files.push(full);
    }
  }
  return files;
}

const loopsDir = fileURLToPath(new URL("../../../../loops", import.meta.url));

describe("repository loop examples", () => {
  const files = yamlFiles(loopsDir);

  it("finds the shipped YAML examples", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [file.slice(loopsDir.length + 1), file]))(
    "parses %s with the current LoopDefinition schema",
    (_name, file) => {
      const parsed = parseLoopYaml(readFileSync(file, "utf8"));
      expect(parsed.name.length).toBeGreaterThan(0);
      expect(parsed.states.every((state) => state.label.length > 0)).toBe(true);
      expect(parsed.transitions.every((transition) => transition.actors.length > 0)).toBe(true);
    },
  );
});
