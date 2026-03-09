// @license MIT
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { aggregateId, correlationId, loopId, stateId, transitionId, type LoopDefinition, type LoopInstance, type TransitionRecord } from "@loopengine/core";
import { computeMetrics } from "../metrics";
import { replayLoop } from "../replay";

describe("observability package", () => {
  it("computeMetrics returns aggregate metrics", () => {
    const instances: LoopInstance[] = [
      {
        loopId: loopId("demo.loop"),
        aggregateId: aggregateId("A-1"),
        orgId: "acme",
        currentState: stateId("DONE"),
        status: "CLOSED",
        startedAt: "2026-01-01T00:00:00.000Z",
        closedAt: "2026-01-02T00:00:00.000Z",
        correlationId: correlationId("corr-1")
      }
    ];
    const history: TransitionRecord[] = [
      {
        id: "r1",
        loopId: loopId("demo.loop"),
        aggregateId: aggregateId("A-1"),
        transitionId: transitionId("finish"),
        fromState: stateId("OPEN"),
        toState: stateId("DONE"),
        actor: { type: "human", id: "user@example.com" as never },
        evidence: {},
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
    const def: LoopDefinition = {
      id: loopId("demo.loop"),
      version: "1.0.0",
      description: "demo",
      domain: "demo",
      states: [{ id: stateId("OPEN") }, { id: stateId("DONE"), isTerminal: true }],
      initialState: stateId("OPEN"),
      transitions: [
        {
          id: transitionId("finish"),
          from: stateId("OPEN"),
          to: stateId("DONE"),
          allowedActors: ["human"]
        }
      ],
      outcome: { id: "done" as never, description: "done", valueUnit: "done", measurable: true }
    };
    const history: TransitionRecord[] = [
      {
        id: "r1",
        loopId: loopId("demo.loop"),
        aggregateId: aggregateId("A-1"),
        transitionId: transitionId("finish"),
        fromState: stateId("OPEN"),
        toState: stateId("DONE"),
        actor: { type: "human", id: "user@example.com" as never },
        evidence: {},
        occurredAt: "2026-01-01T12:00:00.000Z"
      }
    ];
    expect(replayLoop(def, history).valid).toBe(true);
  });
});
