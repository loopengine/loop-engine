// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { mockStudioRunBundle } from "@loop-engine/studio-ui";
import { createMockStudioProviderFromBundle } from "../mock-studio-provider.js";
import { createStudioRunClient } from "../studio-run-client.js";

/**
 * RT-06 primitives consume props; RT-07 client must supply identical DTO shapes.
 */
describe("mock provider ↔ studio-ui fixture parity", () => {
  it("client bundle matches mockStudioRunBundle fields", async () => {
    const runId = mockStudioRunBundle.detail.run.loopRunId;
    const client = createStudioRunClient(createMockStudioProviderFromBundle(mockStudioRunBundle));
    const bundle = await client.getRunBundle(runId);

    expect(bundle.detail).toEqual(mockStudioRunBundle.detail);
    expect(bundle.history).toEqual(mockStudioRunBundle.history);
    expect(bundle.evidence).toEqual(mockStudioRunBundle.evidence);
    expect(bundle.timeline).toEqual(mockStudioRunBundle.timeline);
    expect(bundle.replaySummary).toEqual(mockStudioRunBundle.replaySummary);
  });
});
