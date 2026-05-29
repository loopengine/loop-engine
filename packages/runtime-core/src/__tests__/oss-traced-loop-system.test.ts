// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { describe, expect, it, vi } from "vitest";
import type { LoopEngine, TransitionParams, TransitionResult } from "@loop-engine/runtime";
import type { TraceRecord, TraceStore } from "@loop-engine/observability";

import {
  __resetOssTraceSequencesForTests,
  createOssTracedLoopSystem,
} from "../oss-traced-loop-system.js";
import type { TraceSequenceAllocator } from "../postgres-trace-store.js";

function makeEngine(result: TransitionResult): LoopEngine {
  return {
    start: vi.fn(),
    transition: vi.fn().mockResolvedValue(result),
  } as unknown as LoopEngine;
}

describe("createOssTracedLoopSystem — sequence allocation", () => {
  it("uses TraceSequenceAllocator when the store implements it", async () => {
    __resetOssTraceSequencesForTests();
    const writes: TraceRecord[] = [];
    const allocateNextSequence = vi.fn().mockResolvedValue(7);
    const traceStore = {
      write: vi.fn(async (record: TraceRecord) => {
        writes.push(record);
      }),
      getRunTrace: vi.fn(),
      listRuns: vi.fn(),
      compareRuns: vi.fn(),
      allocateNextSequence,
    } satisfies TraceStore & TraceSequenceAllocator;

    const engine = makeEngine({
      status: "executed",
      toState: "APPROVED",
      fromState: "OPEN",
    });
    const traced = createOssTracedLoopSystem(engine, traceStore, {
      loopId: "loop.demo",
      tenantId: "tenant-a",
    });

    await traced.transition({
      aggregateId: "agg-1" as TransitionParams["aggregateId"],
      transitionId: "submit" as TransitionParams["transitionId"],
      actor: { id: "user:1" as TransitionParams["actor"]["id"], type: "human" },
    });

    expect(allocateNextSequence).toHaveBeenCalledWith("agg-1");
    expect(writes[0]?.sequence).toBe(7);
  });

  it("falls back to in-process sequence for plain memory stores", async () => {
    __resetOssTraceSequencesForTests();
    const writes: TraceRecord[] = [];
    const traceStore = {
      write: vi.fn(async (record: TraceRecord) => {
        writes.push(record);
      }),
      getRunTrace: vi.fn(),
      listRuns: vi.fn(),
      compareRuns: vi.fn(),
    } satisfies TraceStore;

    const engine = makeEngine({
      status: "executed",
      toState: "APPROVED",
      fromState: "OPEN",
    });
    const traced = createOssTracedLoopSystem(engine, traceStore, {
      loopId: "loop.demo",
      tenantId: "tenant-a",
    });

    await traced.transition({
      aggregateId: "agg-2" as TransitionParams["aggregateId"],
      transitionId: "submit" as TransitionParams["transitionId"],
      actor: { id: "user:1" as TransitionParams["actor"]["id"], type: "human" },
    });
    await traced.transition({
      aggregateId: "agg-2" as TransitionParams["aggregateId"],
      transitionId: "approve" as TransitionParams["transitionId"],
      actor: { id: "user:1" as TransitionParams["actor"]["id"], type: "human" },
    });

    expect(writes.map((r) => r.sequence)).toEqual([0, 1]);
  });
});
