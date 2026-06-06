// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { resolveStudioRunUrl, studioRunApiPaths } from "../paths.js";

describe("studioRunApiPaths (RT-05)", () => {
  const runId = "run/demo+1";

  it("uses canonical /api/v1/runs/{id} surfaces", () => {
    expect(studioRunApiPaths.run(runId)).toBe("/api/v1/runs/run%2Fdemo%2B1");
    expect(studioRunApiPaths.history(runId)).toBe("/api/v1/runs/run%2Fdemo%2B1/history");
    expect(studioRunApiPaths.evidence(runId)).toBe("/api/v1/runs/run%2Fdemo%2B1/evidence");
    expect(studioRunApiPaths.timeline(runId)).toBe("/api/v1/runs/run%2Fdemo%2B1/timeline");
    expect(studioRunApiPaths.replaySummary(runId)).toBe(
      "/api/v1/runs/run%2Fdemo%2B1/replay-summary",
    );
  });

  it("resolves against hosted-loops origin", () => {
    expect(resolveStudioRunUrl("http://localhost:3012", studioRunApiPaths.run("r1"))).toBe(
      "http://localhost:3012/api/v1/runs/r1",
    );
  });
});
