// @license MIT
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { LoopEventSchema } from "../schemas";
import { extractLearningSignal } from "../types";

describe("events package", () => {
  it("parses valid loop.started event", () => {
    const result = LoopEventSchema.safeParse({
      type: "loop.started",
      eventId: "e1",
      loopId: "demo.loop",
      aggregateId: "A-1",
      orgId: "acme",
      occurredAt: new Date().toISOString(),
      correlationId: "corr-1",
      initialState: "OPEN",
      actor: { type: "human", id: "user@example.com" }
    });
    expect(result.success).toBe(true);
  });

  it("extractLearningSignal computes numeric delta", () => {
    const completed = {
      type: "loop.completed",
      eventId: "e2",
      loopId: "demo.loop",
      aggregateId: "A-1",
      orgId: "acme",
      occurredAt: "2026-01-04T00:00:00.000Z",
      correlationId: "corr-1",
      terminalState: "DONE",
      actor: { type: "human", id: "user@example.com" },
      durationMs: 1,
      transitionCount: 2,
      outcomeId: "done",
      valueUnit: "done"
    } as const;
    const result = extractLearningSignal(completed as any, [
      {
        occurredAt: "2026-01-01T00:00:00.000Z"
      } as any
    ], {
      cycle_time_days: 2
    });
    expect(typeof result.delta.cycle_time_days).toBe("number");
  });
});
