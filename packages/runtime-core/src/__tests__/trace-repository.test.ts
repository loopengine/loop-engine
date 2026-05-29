// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { describe, expect, it, vi } from "vitest";

import type { PersistTraceInput } from "../trace-repository.js";
import { PrismaTraceRepository } from "../trace-repository.js";

function makeInput(sequence: number): PersistTraceInput {
  return {
    id: `tr-run-1_${sequence}`,
    loopRunId: "run-1",
    loopId: "loop.demo",
    tenantId: "tenant-a",
    sequence,
    timestamp: new Date("2026-05-27T12:00:00.000Z"),
    type: "transition.completed",
    fromState: "OPEN",
    toState: "APPROVED",
    transitionId: "submit",
    actorType: "human",
    actorId: "user:demo",
    inputHash: "abc",
    input: {},
    output: {},
    guards: [],
    evidence: {},
    durationMs: 12,
    blocked: false,
    blockReason: null,
    governed: false,
  };
}

describe("PrismaTraceRepository — RT-20d sequence allocation", () => {
  it("allocateNextSequence returns 0 for an empty run", async () => {
    const db = {
      $transaction: async (fn: (tx: unknown) => Promise<number>) =>
        fn({
          loopTraceRecord: {
            aggregate: async () => ({ _max: { sequence: null } }),
          },
        }),
    };
    const repo = new PrismaTraceRepository(db as never);
    await expect(repo.allocateNextSequence("tenant-a", "run-1")).resolves.toBe(0);
  });

  it("allocateNextSequence returns max+1 when rows exist", async () => {
    const db = {
      $transaction: async (fn: (tx: unknown) => Promise<number>) =>
        fn({
          loopTraceRecord: {
            aggregate: async () => ({ _max: { sequence: 2 } }),
          },
        }),
    };
    const repo = new PrismaTraceRepository(db as never);
    await expect(repo.allocateNextSequence("tenant-a", "run-1")).resolves.toBe(3);
  });

  it("persistTraceWithSummary retries with a fresh sequence on P2002 race", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce({ code: "P2002", meta: { target: ["tenantId", "loopRunId", "sequence"] } })
      .mockResolvedValueOnce(undefined);

    const aggregate = vi
      .fn()
      .mockResolvedValueOnce({ _max: { sequence: 1 } });

    const db = {
      $transaction: async (fn: (tx: unknown) => Promise<void>) =>
        fn({
          loopTraceRecord: { create, aggregate },
          loopRunSummary: {
            findUnique: async () => null,
            create: async () => undefined,
          },
        }),
    };

    const repo = new PrismaTraceRepository(db as never);
    await repo.persistTraceWithSummary(makeInput(1));

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0]?.data.sequence).toBe(1);
    expect(create.mock.calls[1]?.[0]?.data.sequence).toBe(2);
    expect(aggregate).toHaveBeenCalledTimes(1);
  });
});
