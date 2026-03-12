// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { ActorRefSchema, LoopDefinitionSchema, type LoopDefinition } from "@loop-engine/core";
import { createMemoryLoopStorageAdapter, createLoopSystem } from "../index";

function demoLoop(): LoopDefinition {
  return LoopDefinitionSchema.parse({
    loopId: "demo.loop",
    version: "1.0.0",
    name: "Demo Loop",
    description: "Demo loop",
    states: [
      { stateId: "OPEN", label: "Open" },
      { stateId: "DONE", label: "Done", terminal: true }
    ],
    initialState: "OPEN",
    transitions: [
      {
        transitionId: "finish",
        from: "OPEN",
        to: "DONE",
        signal: "demo.finish",
        allowedActors: ["human"]
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
  it("createLoopSystem returns engine, storage, and eventBus", async () => {
    const system = await createLoopSystem({
      loops: [demoLoop()],
      storage: createMemoryLoopStorageAdapter()
    });

    expect(system.engine).toBeDefined();
    expect(system.storage).toBeDefined();
    expect(system.eventBus).toBeDefined();
  });

  it("smoke round-trip works with published createMemoryLoopStorageAdapter", async () => {
    const storage = createMemoryLoopStorageAdapter();
    const system = await createLoopSystem({ loops: [demoLoop()], storage });
    const actor = ActorRefSchema.parse({ id: "user-1", type: "human" });

    const started = await system.engine.startLoop({
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

    const persisted = await storage.getLoop("A-1");
    expect(persisted?.status).toBe("completed");
    expect(persisted?.completedAt).toBeDefined();
  });
});
