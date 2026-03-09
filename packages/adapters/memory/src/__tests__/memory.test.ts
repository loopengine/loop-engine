// @license MIT
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { aggregateId, correlationId, loopId, stateId, transitionId, type LoopInstance, type TransitionRecord } from "@loopengine/core";
import { MemoryStore } from "../index";

describe("MemoryStore", () => {
  it("saves and retrieves instances", async () => {
    const store = new MemoryStore();
    const instance: LoopInstance = {
      loopId: loopId("demo.loop"),
      aggregateId: aggregateId("A-1"),
      orgId: "acme",
      currentState: stateId("OPEN"),
      status: "OPEN",
      startedAt: new Date().toISOString(),
      correlationId: correlationId("corr-1")
    };
    await store.saveInstance(instance);
    const loaded = await store.getInstance(aggregateId("A-1"));
    expect(loaded?.loopId).toBe("demo.loop");
  });

  it("saves transition records in order", async () => {
    const store = new MemoryStore();
    const record: TransitionRecord = {
      id: "r1",
      loopId: loopId("demo.loop"),
      aggregateId: aggregateId("A-1"),
      transitionId: transitionId("go"),
      fromState: stateId("OPEN"),
      toState: stateId("DONE"),
      actor: { type: "human", id: "user@example.com" as never },
      evidence: {},
      occurredAt: new Date().toISOString()
    };
    await store.saveTransitionRecord(record);
    const history = await store.getTransitionHistory(aggregateId("A-1"));
    expect(history).toHaveLength(1);
  });
});
