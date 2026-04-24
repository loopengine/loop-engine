// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import {
  ActorRefSchema,
  LoopDefinitionSchema,
  type LoopDefinition,
  type LoopInstance,
  type TransitionRecord
} from "@loop-engine/core";
import { computeMetrics } from "../metrics";
import { replayLoop } from "../replay";

describe("observability package", () => {
  it("computeMetrics returns aggregate metrics", () => {
    const instances: LoopInstance[] = [
      {
        loopId: "demo.loop",
        aggregateId: "A-1",
        currentState: "DONE",
        status: "completed",
        startedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        completedAt: "2026-01-02T00:00:00.000Z",
        correlationId: "corr-1"
      }
    ];
    const history: TransitionRecord[] = [
      {
        loopId: "demo.loop",
        aggregateId: "A-1",
        transitionId: "finish",
        signal: "demo.finish",
        fromState: "OPEN",
        toState: "DONE",
        actor: ActorRefSchema.parse({ id: "user-1", type: "human" }),
        occurredAt: "2026-01-01T12:00:00.000Z"
      }
    ];
    const metrics = computeMetrics(instances, history, {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T00:00:00.000Z"
    });
    expect(metrics.totalInstances).toBe(1);
    expect(metrics.completionRate).toBe(1);
  });

  it("replayLoop validates transition sequence", () => {
    const def: LoopDefinition = LoopDefinitionSchema.parse({
      id: "demo.loop",
      version: "1.0.0",
      name: "demo.loop",
      description: "demo",
      states: [
        { id: "OPEN", label: "Open" },
        { id: "DONE", label: "Done", isTerminal: true }
      ],
      initialState: "OPEN",
      transitions: [
        {
          id: "finish",
          signal: "demo.finish",
          from: "OPEN",
          to: "DONE",
          actors: ["human"]
        }
      ],
      outcome: {
        description: "done",
        valueUnit: "done",
        businessMetrics: [{ id: "cycle_time_days", label: "Cycle Time", unit: "days" }]
      }
    });
    const history: TransitionRecord[] = [
      {
        loopId: "demo.loop",
        aggregateId: "A-1",
        transitionId: "finish",
        signal: "demo.finish",
        fromState: "OPEN",
        toState: "DONE",
        actor: ActorRefSchema.parse({ id: "user-1", type: "human" }),
        occurredAt: "2026-01-01T12:00:00.000Z"
      }
    ];
    expect(replayLoop(def, history).valid).toBe(true);
  });
});
