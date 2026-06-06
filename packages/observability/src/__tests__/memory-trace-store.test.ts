// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from "vitest";
import { actorId } from "@loop-engine/core";
import { MemoryTraceStore } from "../memory-trace-store.js";
import type { TraceRecord } from "../trace-types.js";

const makeRecord = (override: Partial<TraceRecord> = {}): TraceRecord => ({
  id: "rec-1",
  loopRunId: "run-1",
  loopId: "demo.commerce-discovery",
  sequence: 0,
  timestamp: new Date("2026-04-15T00:00:00Z"),
  type: "transition.completed",
  fromState: "IDLE",
  toState: "DISCOVERING",
  transitionId: "start-discovery",
  actor: { type: "ai-agent", id: actorId("test-agent") },
  inputHash: "abc123",
  input: { query: "running shoes" },
  output: { products: [] },
  guards: [],
  evidence: {},
  durationMs: 42,
  blocked: false,
  blockReason: null,
  governed: true,
  tenantId: "tenant-1",
  ...override,
});

describe("MemoryTraceStore", () => {
  let store: MemoryTraceStore;

  beforeEach(() => {
    store = new MemoryTraceStore();
  });

  it("writes and retrieves a trace record", async () => {
    const record = makeRecord();
    await store.write(record);
    const trace = await store.getRunTrace("run-1");
    expect(trace).toHaveLength(1);
    expect(trace[0]?.sequence).toBe(0);
  });

  it("returns records in sequence order", async () => {
    await store.write(makeRecord({ sequence: 2, id: "rec-3" }));
    await store.write(makeRecord({ sequence: 0, id: "rec-1" }));
    await store.write(makeRecord({ sequence: 1, id: "rec-2" }));
    const trace = await store.getRunTrace("run-1");
    expect(trace.map((r: TraceRecord) => r.sequence)).toEqual([0, 1, 2]);
  });

  it("identifies divergence point in comparison", async () => {
    await store.write(makeRecord({ loopRunId: "run-A", sequence: 0, governed: true }));
    await store.write(makeRecord({ loopRunId: "run-A", sequence: 1, governed: true }));
    await store.write(
      makeRecord({
        loopRunId: "run-A",
        sequence: 2,
        governed: true,
        blocked: true,
        toState: "IDLE",
      }),
    );

    await store.write(makeRecord({ loopRunId: "run-B", sequence: 0, governed: false }));
    await store.write(makeRecord({ loopRunId: "run-B", sequence: 1, governed: false }));
    await store.write(makeRecord({ loopRunId: "run-B", sequence: 2, governed: false, blocked: false }));

    const comparison = await store.compareRuns("run-A", "run-B");
    expect(comparison.divergencePoint).toBe(2);
  });

  it("returns empty array for unknown run", async () => {
    const trace = await store.getRunTrace("nonexistent");
    expect(trace).toEqual([]);
  });
});
