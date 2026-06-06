// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { mockStudioRunBundle } from "@loop-engine/studio-ui";
import {
  MockStudioProvider,
  createMockStudioProviderFromBundle,
} from "../mock-studio-provider.js";
import { createStudioRunClient } from "../studio-run-client.js";

describe("MockStudioProvider", () => {
  const provider = createMockStudioProviderFromBundle(mockStudioRunBundle);
  const runId = mockStudioRunBundle.detail.run.loopRunId;

  it("returns RT-06-aligned fixtures for demo run", async () => {
    const detail = await provider.getRun(runId);
    expect(detail).toEqual(mockStudioRunBundle.detail);
    const history = await provider.getRunHistory(runId);
    expect(history.events.length).toBe(mockStudioRunBundle.history.events.length);
  });

  it("throws not_found for unknown runs", async () => {
    await expect(provider.getRun("missing")).rejects.toMatchObject({ code: "not_found" });
  });

  it("getRunBundle loads all surfaces via StudioRunClient", async () => {
    const client = createStudioRunClient(provider);
    const bundle = await client.getRunBundle(runId);
    expect(bundle.timeline.timeline.transitions.length).toBeGreaterThan(0);
    expect(bundle.replaySummary.sequenceValid).toBe(true);
  });

  it("supports registerRun override", async () => {
    const p = new MockStudioProvider();
    const altRunId = "alt-run";
    p.registerRun(altRunId, {
      ...mockStudioRunBundle,
      detail: {
        ...mockStudioRunBundle.detail,
        run: { ...mockStudioRunBundle.detail.run, loopRunId: altRunId },
      },
    });
    const detail = await p.getRun(altRunId);
    expect(detail.run.loopRunId).toBe(altRunId);
  });
});
