// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { RUNTIME_API_CONTRACT_VERSION } from "@loop-engine/observability";
import {
  mockRunDetail,
  mockRunEvidence,
  mockRunHistory,
  mockRunReplaySummary,
  mockRunTimeline,
  mockStudioRunBundle,
} from "../fixtures/mock-run.js";

describe("mock fixtures (RT-05 DTOs)", () => {
  it("uses frozen contract version", () => {
    expect(mockRunDetail.contractVersion).toBe(RUNTIME_API_CONTRACT_VERSION);
    expect(mockRunHistory.contractVersion).toBe(RUNTIME_API_CONTRACT_VERSION);
  });

  it("aligns evidence items with history events", () => {
    expect(mockRunEvidence.items).toHaveLength(mockRunHistory.events.length);
    expect(mockRunEvidence.loopRunId).toBe(mockRunHistory.loopRunId);
  });

  it("replay summary matches timeline transition count", () => {
    expect(mockRunReplaySummary.transitionCount).toBe(
      mockRunTimeline.timeline.transitions.length,
    );
    expect(mockRunReplaySummary.sequenceValid).toBe(true);
  });

  it("exposes demo bundle", () => {
    expect(mockStudioRunBundle.detail.run.loopRunId).toBe("run_demo_01");
  });
});
