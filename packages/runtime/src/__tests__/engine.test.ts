// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import {
  ActorRefSchema,
  LoopDefinitionSchema,
  type AggregateId,
  type LoopDefinition,
  type LoopId
} from "@loop-engine/core";
import type { LoopEvent } from "@loop-engine/events";
import { GuardRegistry } from "@loop-engine/guards";
import type {
  EventBus,
  LoopDefinitionRegistry,
  LoopStorageAdapter,
  RuntimeLoopInstance,
  RuntimeTransitionRecord
} from "../interfaces";
import { createLoopSystem } from "../engine";

class MemoryAdapter implements LoopStorageAdapter {
  loops = new Map<AggregateId, RuntimeLoopInstance>();
  transitions = new Map<AggregateId, RuntimeTransitionRecord[]>();
  lastUpdated?: RuntimeLoopInstance;

  async getLoop(aggregateId: AggregateId): Promise<RuntimeLoopInstance | null> {
    return this.loops.get(aggregateId) ?? null;
  }

  async createLoop(instance: RuntimeLoopInstance): Promise<void> {
    this.loops.set(instance.aggregateId, instance);
  }

  async updateLoop(instance: RuntimeLoopInstance): Promise<void> {
    this.lastUpdated = instance;
    this.loops.set(instance.aggregateId, instance);
  }

  async appendTransition(record: RuntimeTransitionRecord): Promise<void> {
    const current = this.transitions.get(record.aggregateId) ?? [];
    current.push(record);
    this.transitions.set(record.aggregateId, current);
  }

  async getTransitions(aggregateId: AggregateId): Promise<RuntimeTransitionRecord[]> {
    return this.transitions.get(aggregateId) ?? [];
  }

  async listOpenLoops(loopId: LoopId): Promise<RuntimeLoopInstance[]> {
    return [...this.loops.values()].filter(
      (instance) => instance.loopId === loopId && instance.status === "active"
    );
  }
}

class MemoryRegistry implements LoopDefinitionRegistry {
  constructor(private readonly defs: LoopDefinition[]) {}

  get(id: LoopId): LoopDefinition | undefined {
    return this.defs.find((d) => d.loopId === id);
  }

  list(): LoopDefinition[] {
    return this.defs;
  }
}

function demoLoop(): LoopDefinition {
  return LoopDefinitionSchema.parse({
    loopId: "demo.loop",
    version: "1.0.0",
    name: "Demo Loop",
    description: "Demo loop",
    states: [
      { stateId: "OPEN", label: "Open" },
      { stateId: "IN_REVIEW", label: "In Review" },
      { stateId: "DONE", label: "Done", terminal: true }
    ],
    initialState: "OPEN",
    transitions: [
      {
        transitionId: "review",
        from: "OPEN",
        to: "IN_REVIEW",
        signal: "ticket.review",
        allowedActors: ["human", "automation", "ai-agent"]
      },
      {
        transitionId: "close",
        from: "IN_REVIEW",
        to: "DONE",
        signal: "ticket.close",
        allowedActors: ["human"],
        guards: [
          {
            guardId: "approval-obtained",
            description: "Approval required",
            severity: "hard",
            evaluatedBy: "runtime"
          }
        ]
      }
    ],
    outcome: {
      description: "Done",
      valueUnit: "resolution",
      businessMetrics: [{ id: "cycle_time_days", label: "Cycle Time", unit: "days" }]
    }
  });
}

describe("LoopEngine", () => {
  it("1) startLoop creates instance at initialState", async () => {
    const storage = new MemoryAdapter();
    const system = createLoopSystem({ registry: new MemoryRegistry([demoLoop()]), storage });

    const started = await system.startLoop({
      loopId: "demo.loop",
      aggregateId: "A-1",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" }),
      correlationId: "corr-1"
    });

    expect(started.currentState).toBe("OPEN");
    expect(started.status).toBe("active");
  });

  it("2) startLoop emits loop.started", async () => {
    const storage = new MemoryAdapter();
    const events: LoopEvent[] = [];
    const eventBus: EventBus = {
      async emit(event) {
        events.push(event);
      }
    };
    const system = createLoopSystem({
      registry: new MemoryRegistry([demoLoop()]),
      storage,
      eventBus
    });

    await system.startLoop({
      loopId: "demo.loop",
      aggregateId: "A-2",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });

    expect(events.some((event) => event.type === "loop.started")).toBe(true);
  });

  it("3) transition executes valid path", async () => {
    const storage = new MemoryAdapter();
    const system = createLoopSystem({ registry: new MemoryRegistry([demoLoop()]), storage });
    await system.startLoop({
      loopId: "demo.loop",
      aggregateId: "A-3",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });
    const result = await system.transition({
      aggregateId: "A-3",
      transitionId: "review",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });

    expect(result.status).toBe("executed");
    expect(result.toState).toBe("IN_REVIEW");
  });

  it("4) transition rejects invalid transition", async () => {
    const storage = new MemoryAdapter();
    const system = createLoopSystem({ registry: new MemoryRegistry([demoLoop()]), storage });
    await system.startLoop({
      loopId: "demo.loop",
      aggregateId: "A-4",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });

    const result = await system.transition({
      aggregateId: "A-4",
      transitionId: "missing",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toBe("invalid_transition");
  });

  it("5) transition rejects unauthorized actor before guard evaluation", async () => {
    const storage = new MemoryAdapter();
    const system = createLoopSystem({ registry: new MemoryRegistry([demoLoop()]), storage });
    await system.startLoop({
      loopId: "demo.loop",
      aggregateId: "A-5",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });

    await system.transition({
      aggregateId: "A-5",
      transitionId: "review",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });

    const result = await system.transition({
      aggregateId: "A-5",
      transitionId: "close",
      actor: ActorRefSchema.parse({ id: "agent-1", type: "ai-agent" })
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toBe("unauthorized_actor");
  });

  it("6) transition blocks on hard guard failure and keeps state unchanged", async () => {
    const storage = new MemoryAdapter();
    const guardRegistry = new GuardRegistry();
    guardRegistry.register("approval-obtained", {
      async evaluate() {
        return { passed: false, message: "Approval missing" };
      }
    });
    const system = createLoopSystem({
      registry: new MemoryRegistry([demoLoop()]),
      storage,
      guardRegistry
    });

    await system.startLoop({
      loopId: "demo.loop",
      aggregateId: "A-6",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });
    await system.transition({
      aggregateId: "A-6",
      transitionId: "review",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });

    const result = await system.transition({
      aggregateId: "A-6",
      transitionId: "close",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });
    const current = await storage.getLoop("A-6");

    expect(result.status).toBe("guard_failed");
    expect(current?.currentState).toBe("IN_REVIEW");
  });

  it("7) transition continues on soft guard failures", async () => {
    const storage = new MemoryAdapter();
    const loop = LoopDefinitionSchema.parse({
      ...demoLoop(),
      transitions: [
        ...demoLoop().transitions.slice(0, 1),
        {
          ...demoLoop().transitions[1],
          guards: [
            {
              guardId: "soft-warning",
              description: "warning",
              severity: "soft",
              evaluatedBy: "runtime"
            }
          ]
        }
      ]
    });
    const guardRegistry = new GuardRegistry();
    guardRegistry.register("soft-warning", {
      async evaluate() {
        return { passed: false, message: "Soft warning" };
      }
    });
    const system = createLoopSystem({
      registry: new MemoryRegistry([loop]),
      storage,
      guardRegistry
    });

    await system.startLoop({
      loopId: "demo.loop",
      aggregateId: "A-7",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });
    await system.transition({
      aggregateId: "A-7",
      transitionId: "review",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });
    const result = await system.transition({
      aggregateId: "A-7",
      transitionId: "close",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });

    expect(result.status).toBe("executed");
    expect(result.guardFailures?.[0]?.severity).toBe("soft");
  });

  it("8) transition emits requested before executed", async () => {
    const storage = new MemoryAdapter();
    const events: LoopEvent[] = [];
    const eventBus: EventBus = {
      async emit(event) {
        events.push(event);
      }
    };
    const guardRegistry = new GuardRegistry();
    guardRegistry.register("approval-obtained", { async evaluate() { return { passed: true, message: "ok" }; } });
    const system = createLoopSystem({
      registry: new MemoryRegistry([demoLoop()]),
      storage,
      eventBus,
      guardRegistry
    });

    await system.startLoop({
      loopId: "demo.loop",
      aggregateId: "A-8",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });
    await system.transition({
      aggregateId: "A-8",
      transitionId: "review",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });
    await system.transition({
      aggregateId: "A-8",
      transitionId: "close",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });

    const requestedIndex = events.findIndex((event) => event.type === "loop.transition.requested");
    const executedIndex = events.findIndex((event) => event.type === "loop.transition.executed");
    expect(requestedIndex).toBeGreaterThanOrEqual(0);
    expect(executedIndex).toBeGreaterThan(requestedIndex);
  });

  it("9) terminal transition updates storage to completed before loop.completed emission", async () => {
    const storage = new MemoryAdapter();
    let completedStatePersistedBeforeEvent = false;
    const eventBus: EventBus = {
      emit: async (event) => {
        if (event.type === "loop.completed") {
          const persisted = await storage.getLoop("A-9");
          completedStatePersistedBeforeEvent = Boolean(
            persisted?.status === "completed" && persisted.completedAt
          );
        }
      }
    };
    const guardRegistry = new GuardRegistry();
    guardRegistry.register("approval-obtained", { async evaluate() { return { passed: true, message: "ok" }; } });
    const system = createLoopSystem({
      registry: new MemoryRegistry([demoLoop()]),
      storage,
      eventBus,
      guardRegistry
    });

    await system.startLoop({
      loopId: "demo.loop",
      aggregateId: "A-9",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });
    await system.transition({
      aggregateId: "A-9",
      transitionId: "review",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });
    await system.transition({
      aggregateId: "A-9",
      transitionId: "close",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });

    expect(completedStatePersistedBeforeEvent).toBe(true);
  });

  it("10) terminal transition emits loop.completed event", async () => {
    const storage = new MemoryAdapter();
    const events: LoopEvent[] = [];
    const guardRegistry = new GuardRegistry();
    guardRegistry.register("approval-obtained", { async evaluate() { return { passed: true, message: "ok" }; } });
    const system = createLoopSystem({
      registry: new MemoryRegistry([demoLoop()]),
      storage,
      eventBus: { emit: async (event) => events.push(event) },
      guardRegistry
    });

    await system.startLoop({
      loopId: "demo.loop",
      aggregateId: "A-10",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });
    await system.transition({
      aggregateId: "A-10",
      transitionId: "review",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });
    await system.transition({
      aggregateId: "A-10",
      transitionId: "close",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });

    expect(events.some((event) => event.type === "loop.completed")).toBe(true);
  });

  it("11) transition after terminal completion is rejected as loop_closed", async () => {
    const storage = new MemoryAdapter();
    const guardRegistry = new GuardRegistry();
    guardRegistry.register("approval-obtained", { async evaluate() { return { passed: true, message: "ok" }; } });
    const system = createLoopSystem({
      registry: new MemoryRegistry([demoLoop()]),
      storage,
      guardRegistry
    });

    await system.startLoop({
      loopId: "demo.loop",
      aggregateId: "A-11",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });
    await system.transition({
      aggregateId: "A-11",
      transitionId: "review",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });
    await system.transition({
      aggregateId: "A-11",
      transitionId: "close",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });

    const result = await system.transition({
      aggregateId: "A-11",
      transitionId: "close",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" })
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toBe("loop_closed");
  });
});
