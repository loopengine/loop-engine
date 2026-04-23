// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { memoryStore } from "../index";

describe("@loop-engine/adapter-memory", () => {
  it("saves and loads loop instances", async () => {
    const store = memoryStore();
    await store.saveInstance({
      loopId: "demo.loop",
      aggregateId: "A-1",
      currentState: "OPEN",
      status: "active",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const loaded = await store.getInstance("A-1");
    expect(loaded?.loopId).toBe("demo.loop");
  });

  it("saves and returns transition history in order", async () => {
    const store = memoryStore();
    await store.saveTransitionRecord({
      aggregateId: "A-2",
      loopId: "demo.loop",
      transitionId: "review",
      signal: "ticket.review",
      fromState: "OPEN",
      toState: "IN_REVIEW",
      actor: { id: "user-1", type: "human" },
      occurredAt: new Date().toISOString()
    });
    await store.saveTransitionRecord({
      aggregateId: "A-2",
      loopId: "demo.loop",
      transitionId: "close",
      signal: "ticket.close",
      fromState: "IN_REVIEW",
      toState: "DONE",
      actor: { id: "user-1", type: "human" },
      occurredAt: new Date().toISOString()
    });

    const history = await store.getTransitionHistory("A-2");
    expect(history).toHaveLength(2);
    expect(history[0]?.transitionId).toBe("review");
    expect(history[1]?.transitionId).toBe("close");
  });
});
