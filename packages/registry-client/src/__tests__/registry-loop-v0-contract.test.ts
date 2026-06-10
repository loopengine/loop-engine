// SPDX-License-Identifier: Apache-2.0
/**
 * RT-03 — SDK client URLs align with registry-loop v0 read contract (frozen RT-01/RT-02).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";
import { v0Registry } from "../adapters/v0";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const REGISTRY_SPEC = path.join(REPO_ROOT, "docs/specs/loop-registry-api-v0.md");

describe("registry-loop v0 contract (SDK client)", () => {
  const spec = readFileSync(REGISTRY_SPEC, "utf8");

  it("spec documents v0 read endpoints used by v0Registry", () => {
    for (const endpoint of [
      "GET /v0/loops",
      "GET /v0/loops/{loopId}",
      "GET /v0/loops/{loopId}/versions/{version}",
    ]) {
      expect(spec).toContain(endpoint);
    }
  });

  it("v0Registry issues spec-correct paths against registry-loop origin", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes("/versions/")) {
        return new Response(
          JSON.stringify({
            id: "scm.replenishment",
            version: "1.0.0",
            definition: {
              id: "scm.replenishment",
              version: "1.0.0",
              name: "scm.replenishment",
              description: "seed",
              states: [
                { id: "OPEN", label: "Open" },
                { id: "DONE", label: "Done", isTerminal: true },
              ],
              initialState: "OPEN",
              transitions: [
                {
                  id: "close",
                  from: "OPEN",
                  to: "DONE",
                  signal: "scm.close",
                  actors: ["automation"],
                },
              ],
              outcome: {
                description: "Done",
                valueUnit: "done",
                businessMetrics: [{ id: "cycle_time_days", label: "Cycle Time", unit: "days" }],
              },
            },
            manifest: { title: "scm.replenishment" },
            integrity: { sha256: "abc", signature: null, signatureKeyId: null },
            publishedAt: new Date().toISOString(),
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          loop: {
            id: "scm.replenishment",
            latestVersion: "1.0.0",
            latestStableVersion: "1.0.0",
            domain: "scm",
          },
          recommendedVersion: "1.0.0",
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const registry = v0Registry({ baseUrl: "http://registry-loop:3011", channel: "stable" });
    const found = await registry.get("scm.replenishment" as never);

    expect(found?.id).toBe("scm.replenishment");
    expect(calls[0]).toBe("http://registry-loop:3011/v0/loops/scm.replenishment?channel=stable");
    expect(calls[1]).toBe("http://registry-loop:3011/v0/loops/scm.replenishment/versions/1.0.0");

    vi.unstubAllGlobals();
  });
});
