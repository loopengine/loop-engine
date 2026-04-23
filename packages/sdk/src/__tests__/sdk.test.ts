// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { ActorRefSchema, LoopDefinitionSchema, type LoopDefinition } from "@loop-engine/core";
import { memoryStore, createLoopSystem } from "../index";

function demoLoop(): LoopDefinition {
  return LoopDefinitionSchema.parse({
    id: "demo.loop",
    version: "1.0.0",
    name: "Demo Loop",
    description: "Demo loop",
    states: [
      { id: "OPEN", label: "Open" },
      { id: "DONE", label: "Done", isTerminal: true }
    ],
    initialState: "OPEN",
    transitions: [
      {
        id: "finish",
        from: "OPEN",
        to: "DONE",
        signal: "demo.finish",
        actors: ["human"]
      }
    ],
    outcome: {
      description: "Done",
      valueUnit: "done",
      businessMetrics: [{ id: "cycle_time_days", label: "Cycle Time", unit: "days" }]
    }
  });
}

describe("sdk", () => {
  it("createLoopSystem returns engine, store, and eventBus", async () => {
    const system = await createLoopSystem({
      loops: [demoLoop()],
      store: memoryStore()
    });

    expect(system.engine).toBeDefined();
    expect(system.store).toBeDefined();
    expect(system.eventBus).toBeDefined();
  });

  it("smoke round-trip works with published memoryStore", async () => {
    const store = memoryStore();
    const system = await createLoopSystem({ loops: [demoLoop()], store });
    const actor = ActorRefSchema.parse({ id: "user-1", type: "human" });

    const started = await system.engine.start({
      loopId: "demo.loop",
      aggregateId: "A-1",
      actor
    });
    expect(started.currentState).toBe("OPEN");

    const transitioned = await system.engine.transition({
      aggregateId: "A-1",
      transitionId: "finish",
      actor
    });
    expect(transitioned.status).toBe("executed");
    expect(transitioned.toState).toBe("DONE");

    const persisted = await store.getInstance("A-1");
    expect(persisted?.status).toBe("completed");
    expect(persisted?.completedAt).toBeDefined();
  });
});
