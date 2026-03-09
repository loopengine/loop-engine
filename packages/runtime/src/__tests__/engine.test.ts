// @license MIT
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { aggregateId, correlationId, loopId, outcomeId, stateId, transitionId, type LoopDefinition, type LoopInstance, type LoopRegistry, type TransitionRecord } from "@loopengine/core";
import type { EventBus, GuardEvaluator, LoopStore } from "../interfaces";
import { createLoopEngine } from "../engine";

class MemoryStore implements LoopStore {
  instance = new Map<string, LoopInstance>();
  records = new Map<string, TransitionRecord[]>();

  async getInstance(id: ReturnType<typeof aggregateId>): Promise<LoopInstance | null> {
    return this.instance.get(id) ?? null;
  }
  async saveInstance(instance: LoopInstance): Promise<void> {
    this.instance.set(instance.aggregateId, instance);
  }
  async getTransitionHistory(id: ReturnType<typeof aggregateId>): Promise<TransitionRecord[]> {
    return this.records.get(id) ?? [];
  }
  async saveTransitionRecord(record: TransitionRecord): Promise<void> {
    const current = this.records.get(record.aggregateId) ?? [];
    current.push(record);
    this.records.set(record.aggregateId, current);
  }
  async listOpenInstances(loop: ReturnType<typeof loopId>, orgId: string): Promise<LoopInstance[]> {
    return [...this.instance.values()].filter(
      (i) => i.loopId === loop && i.orgId === orgId && i.status !== "CLOSED" && i.status !== "ERROR"
    );
  }
}

class MemoryRegistry implements LoopRegistry {
  constructor(private readonly defs: LoopDefinition[]) {}
  get(id: ReturnType<typeof loopId>): LoopDefinition | undefined {
    return this.defs.find((d) => d.id === id);
  }
  list(domain?: string): LoopDefinition[] {
    return domain ? this.defs.filter((d) => d.domain === domain) : this.defs;
  }
}

function demoLoop(): LoopDefinition {
  return {
    id: loopId("demo.loop"),
    version: "1.0.0",
    description: "Demo loop",
    domain: "demo",
    states: [stateId("OPEN"), stateId("IN_REVIEW"), stateId("DONE")].map((id) => ({ id, isTerminal: id === "DONE" })),
    initialState: stateId("OPEN"),
    transitions: [
      {
        id: transitionId("review"),
        from: stateId("OPEN"),
        to: stateId("IN_REVIEW"),
        allowedActors: ["human", "ai-agent"]
      },
      {
        id: transitionId("close"),
        from: stateId("IN_REVIEW"),
        to: stateId("DONE"),
        allowedActors: ["human"],
        guards: [
          {
            id: "approval_obtained" as never,
            description: "Approval required",
            failureMessage: "Approval missing",
            severity: "hard",
            evaluatedBy: "runtime"
          }
        ]
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

describe("LoopEngine", () => {
  it("start() creates instance at initialState", async () => {
    const store = new MemoryStore();
    const engine = createLoopEngine({ registry: new MemoryRegistry([demoLoop()]), store });
    const started = await engine.start({
      loopId: "demo.loop",
      aggregateId: aggregateId("A-1"),
      orgId: "acme",
      actor: { type: "human", id: "user@example.com" },
      correlationId: correlationId("corr-1")
    });
    expect(started.currentState).toBe("OPEN");
  });

  it("transition() advances state correctly", async () => {
    const store = new MemoryStore();
    const engine = createLoopEngine({ registry: new MemoryRegistry([demoLoop()]), store });
    await engine.start({
      loopId: "demo.loop",
      aggregateId: aggregateId("A-2"),
      orgId: "acme",
      actor: { type: "human", id: "user@example.com" }
    });
    const result = await engine.transition({
      aggregateId: aggregateId("A-2"),
      transitionId: transitionId("review"),
      actor: { type: "human", id: "user@example.com" }
    });
    expect(result.status).toBe("executed");
    expect(result.toState).toBe("IN_REVIEW");
  });

  it("transition() rejects unknown transitionId", async () => {
    const store = new MemoryStore();
    const engine = createLoopEngine({ registry: new MemoryRegistry([demoLoop()]), store });
    await engine.start({
      loopId: "demo.loop",
      aggregateId: aggregateId("A-3"),
      orgId: "acme",
      actor: { type: "human", id: "user@example.com" }
    });
    const result = await engine.transition({
      aggregateId: aggregateId("A-3"),
      transitionId: transitionId("missing"),
      actor: { type: "human", id: "user@example.com" }
    });
    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toBe("invalid_transition");
  });

  it("hard guard failure returns guard_failed without advancing state", async () => {
    const store = new MemoryStore();
    const guardEvaluator: GuardEvaluator = {
      async evaluate() {
        return { passed: false, message: "No approval" };
      }
    };
    const engine = createLoopEngine({ registry: new MemoryRegistry([demoLoop()]), store, guardEvaluator });
    await engine.start({
      loopId: "demo.loop",
      aggregateId: aggregateId("A-4"),
      orgId: "acme",
      actor: { type: "human", id: "user@example.com" }
    });
    await engine.transition({
      aggregateId: aggregateId("A-4"),
      transitionId: transitionId("review"),
      actor: { type: "human", id: "user@example.com" }
    });
    const result = await engine.transition({
      aggregateId: aggregateId("A-4"),
      transitionId: transitionId("close"),
      actor: { type: "human", id: "user@example.com" }
    });
    const state = await engine.getState(aggregateId("A-4"));
    expect(result.status).toBe("guard_failed");
    expect(state?.currentState).toBe("IN_REVIEW");
  });

  it("terminal state transition emits LoopCompletedEvent", async () => {
    const store = new MemoryStore();
    const events: unknown[] = [];
    const eventBus: EventBus = {
      async emit(event) {
        events.push(event);
      },
      subscribe() {
        return () => {};
      }
    };
    const guardEvaluator: GuardEvaluator = { async evaluate() { return { passed: true }; } };
    const engine = createLoopEngine({ registry: new MemoryRegistry([demoLoop()]), store, guardEvaluator, eventBus });
    await engine.start({
      loopId: "demo.loop",
      aggregateId: aggregateId("A-5"),
      orgId: "acme",
      actor: { type: "human", id: "user@example.com" }
    });
    await engine.transition({
      aggregateId: aggregateId("A-5"),
      transitionId: transitionId("review"),
      actor: { type: "human", id: "user@example.com" }
    });
    await engine.transition({
      aggregateId: aggregateId("A-5"),
      transitionId: transitionId("close"),
      actor: { type: "human", id: "user@example.com" },
      evidence: { approved: true }
    });
    expect(events.some((e: any) => e.type === "loop.completed")).toBe(true);
  });

  it("getHistory() returns ordered transition records", async () => {
    const store = new MemoryStore();
    const guardEvaluator: GuardEvaluator = { async evaluate() { return { passed: true }; } };
    const engine = createLoopEngine({ registry: new MemoryRegistry([demoLoop()]), store, guardEvaluator });
    await engine.start({
      loopId: "demo.loop",
      aggregateId: aggregateId("A-6"),
      orgId: "acme",
      actor: { type: "human", id: "user@example.com" }
    });
    await engine.transition({
      aggregateId: aggregateId("A-6"),
      transitionId: transitionId("review"),
      actor: { type: "human", id: "user@example.com" }
    });
    const history = await engine.getHistory(aggregateId("A-6"));
    expect(history).toHaveLength(1);
    expect(history[0]?.transitionId).toBe("review");
  });
});
