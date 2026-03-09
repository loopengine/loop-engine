// @license MIT
// SPDX-License-Identifier: MIT
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createLocalRegistry } from "../local";

describe("registry-client local", () => {
  it("loads YAML loops and supports get/install", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "loopengine-reg-"));
    await writeFile(
      path.join(dir, "demo.yaml"),
      `
id: demo.loop
version: 1.0.0
description: demo
domain: demo
states:
  - id: OPEN
  - id: DONE
initialState: OPEN
transitions:
  - id: finish
    from: OPEN
    to: DONE
    allowedActors: [human]
outcome:
  id: done
  description: done
  valueUnit: done
  measurable: true
`,
      "utf8"
    );

    const client = await createLocalRegistry(dir);
    const found = await client.get("demo.loop");
    expect(found?.id).toBe("demo.loop");
    const installed = await client.install("demo.loop");
    expect(installed.installedVersion).toBe("1.0.0");
  });
});
