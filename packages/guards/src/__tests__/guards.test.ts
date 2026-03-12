// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { actorId, aggregateId, guardId, loopId, stateId, transitionId } from "@loop-engine/core";
import { defaultRegistry } from "../index";

describe("guard registry", () => {
  it("approval_obtained passes when approved is true", async () => {
    const evaluator = defaultRegistry.createEvaluator();
    const result = await evaluator.evaluate(guardId("approval_obtained"), {
      loopId: loopId("demo.loop"),
      aggregateId: aggregateId("A-1"),
      transitionId: transitionId("approve"),
      actor: { type: "human", id: actorId("user@example.com") },
      evidence: { approved: true },
      currentState: stateId("OPEN"),
      instance: {
        loopId: loopId("demo.loop"),
        aggregateId: aggregateId("A-1"),
        orgId: "acme",
        currentState: stateId("OPEN"),
        status: "OPEN",
        startedAt: new Date().toISOString(),
        correlationId: "corr-1" as never
      }
    });
    expect(result.passed).toBe(true);
  });
});
