// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from "vitest";
import {
  aggregateId,
  loopId,
  outcomeId,
  stateId,
  transitionId,
  type LoopDefinition
} from "@loop-engine/core";
import type { LoopRegistry } from "@loop-engine/registry-client";
import { localRegistry } from "../../../registry-client/src/adapters/local";
import { createLoopSystem } from "../index";

function makeLoop(id: string, description: string): LoopDefinition {
  return {
    id: loopId(id),
    version: "1.0.0",
    description,
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
    outcome: {
      id: outcomeId("done"),
      description: "Done",
      valueUnit: "done",
      measurable: true
    }
  };
}

function makeLoopWithTransition(id: string, transitionName: string): LoopDefinition {
  return {
    id: loopId(id),
    version: "1.0.0",
    description: `${id} with ${transitionName}`,
    domain: "demo",
    states: [{ id: stateId("OPEN") }, { id: stateId("DONE"), isTerminal: true }],
    initialState: stateId("OPEN"),
    transitions: [
      {
        id: transitionId(transitionName),
        from: stateId("OPEN"),
        to: stateId("DONE"),
        allowedActors: ["human"]
      }
    ],
    outcome: {
      id: outcomeId("done"),
      description: "Done",
      valueUnit: "done",
      measurable: true
    }
  };
}

describe("sdk registry integration", () => {
  it("should load definitions from registry on startup", async () => {
    const registry = localRegistry([makeLoop("demo.registry", "registry loop")]);
    const system = await createLoopSystem({ loops: [], registry });

    const started = await system.engine.start({
      loopId: "demo.registry",
      aggregateId: aggregateId("A-1"),
      orgId: "acme",
      actor: { type: "human", id: "user@acme.com" }
    });

    expect(started.loopId).toBe(loopId("demo.registry"));
  });

  it("should use locally provided loops[] definitions over registry on conflict", async () => {
    const remote = makeLoopWithTransition("demo.conflict", "remote_finish");
    const local = makeLoopWithTransition("demo.conflict", "local_finish");
    const registry = localRegistry([remote]);

    const system = await createLoopSystem({ loops: [local], registry });
    await system.engine.start({
      loopId: "demo.conflict",
      aggregateId: aggregateId("A-2"),
      orgId: "acme",
      actor: { type: "human", id: "user@acme.com" }
    });
    const transitionResult = await system.engine.transition({
      aggregateId: aggregateId("A-2"),
      transitionId: transitionId("local_finish"),
      actor: { type: "human", id: "user@acme.com" }
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
    const started = await system.engine.start({
      loopId: "demo.fallback",
      aggregateId: aggregateId("A-3"),
      orgId: "acme",
      actor: { type: "human", id: "user@acme.com" }
    });
    expect(started.loopId).toBe(loopId("demo.fallback"));
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
