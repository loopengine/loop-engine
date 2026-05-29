/**
 * RT-04 — Canonical trace types exported from @loop-engine/observability.
 */
import { describe, expect, it } from "vitest";
import {
  MemoryTraceStore,
  buildTimelineFromTrace,
  type TraceRecord,
  type TraceStore,
} from "../index.js";

describe("@loop-engine/observability trace exports", () => {
  it("exports TraceStore contract and MemoryTraceStore", () => {
    const store: TraceStore = new MemoryTraceStore();
    expect(typeof store.write).toBe("function");
    expect(typeof store.getRunTrace).toBe("function");
    expect(typeof store.listRuns).toBe("function");
    expect(typeof store.compareRuns).toBe("function");
  });

  it("exports TraceRecord shape used by hosted trace-wrapper", () => {
    const sample: TraceRecord = {
      id: "t1",
      loopRunId: "run-1",
      loopId: "demo.loop",
      sequence: 0,
      timestamp: new Date(),
      type: "transition.completed",
      fromState: "OPEN",
      toState: "DONE",
      transitionId: "finish",
      actor: { type: "human", id: "user-1" as TraceRecord["actor"]["id"] },
      inputHash: "abc",
      input: {},
      output: {},
      guards: [],
      evidence: {},
      durationMs: 1,
      blocked: false,
      blockReason: null,
      governed: true,
      tenantId: "tenant-1",
    };
    expect(sample.loopRunId).toBe("run-1");
  });

  it("exports buildTimelineFromTrace for trace rows", () => {
    expect(typeof buildTimelineFromTrace).toBe("function");
  });
});
