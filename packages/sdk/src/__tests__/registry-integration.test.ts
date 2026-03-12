// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from "vitest";
import { ActorRefSchema, LoopDefinitionSchema, type LoopDefinition } from "@loop-engine/core";
import type { LoopRegistry } from "@loop-engine/registry-client";
import { localRegistry } from "@loop-engine/registry-client";
import { createLoopSystem } from "../index";

function makeLoop(id: string, description: string): LoopDefinition {
  return LoopDefinitionSchema.parse({
    loopId: id,
    version: "1.0.0",
    name: id,
    description,
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

function makeLoopWithTransition(id: string, transitionName: string): LoopDefinition {
  return LoopDefinitionSchema.parse({
    loopId: id,
    version: "1.0.0",
    name: id,
    description: `${id} with ${transitionName}`,
    states: [
      { stateId: "OPEN", label: "Open" },
      { stateId: "DONE", label: "Done", terminal: true }
    ],
    initialState: "OPEN",
    transitions: [
      {
        transitionId: transitionName,
        from: "OPEN",
        to: "DONE",
        signal: `demo.${transitionName}`,
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

describe("sdk registry integration", () => {
  it("should load definitions from registry on startup", async () => {
    const registry = localRegistry([makeLoop("demo.registry", "registry loop")]);
    const system = await createLoopSystem({ loops: [], registry });
    const actor = ActorRefSchema.parse({ id: "user-1", type: "human" });

    const started = await system.engine.startLoop({
      loopId: "demo.registry",
      aggregateId: "A-1",
      actor
    });

    expect(started.loopId).toBe("demo.registry");
  });

  it("should use locally provided loops[] definitions over registry on conflict", async () => {
    const remote = makeLoopWithTransition("demo.conflict", "remote_finish");
    const local = makeLoopWithTransition("demo.conflict", "local_finish");
    const registry = localRegistry([remote]);

    const system = await createLoopSystem({ loops: [local], registry });
    const actor = ActorRefSchema.parse({ id: "user-1", type: "human" });
    await system.engine.startLoop({
      loopId: "demo.conflict",
      aggregateId: "A-2",
      actor
    });
    const transitionResult = await system.engine.transition({
      aggregateId: "A-2",
      transitionId: "local_finish",
      actor
    });
    expect(transitionResult.status).toBe("executed");
  });

  it("should start successfully when registry.list() throws", async () => {
    const fallbackLoop = makeLoop("demo.fallback", "local fallback");
    const failingRegistry: LoopRegistry = {
      get: async () => null,
      getVersion: async () => null,
      list: async () => {
        throw new Error("network down");
      },
      has: async () => false,
      register: async () => {},
      remove: async () => false
    };

    const system = await createLoopSystem({ loops: [fallbackLoop], registry: failingRegistry });
    const started = await system.engine.startLoop({
      loopId: "demo.fallback",
      aggregateId: "A-3",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });
    expect(started.loopId).toBe("demo.fallback");
  });

  it("should log a warning when registry fails to load", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failingRegistry: LoopRegistry = {
      get: async () => null,
      getVersion: async () => null,
      list: async () => {
        throw new Error("boom");
      },
      has: async () => false,
      register: async () => {},
      remove: async () => false
    };
    await createLoopSystem({ loops: [makeLoop("demo.warn", "warn")], registry: failingRegistry });
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it("should work with no registry provided (backward compatible)", async () => {
    const system = await createLoopSystem({ loops: [makeLoop("demo.noreg", "no registry")] });
    expect(system.engine).toBeDefined();
    expect(system.eventBus).toBeDefined();
  });
});
