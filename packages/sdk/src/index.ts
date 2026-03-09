// @license MIT
// SPDX-License-Identifier: MIT
import { memoryStore } from "@loop-engine/adapter-memory";
import type { LoopDefinition } from "@loop-engine/core";
import { LoopBuilder } from "@loop-engine/dsl";
import { InMemoryEventBus } from "@loop-engine/events";
import { defaultRegistry as guardRegistry, type GuardRegistry } from "@loop-engine/guards";
import { computeMetrics, buildTimeline } from "@loop-engine/observability";
import { createLoopEngine, type LoopEngine, type LoopStore } from "@loop-engine/runtime";
import { createSignalEngine, type SignalEngine } from "@loop-engine/signals";

class InMemoryLoopRegistry {
  constructor(private readonly loops: LoopDefinition[]) {}
  get(id: LoopDefinition["id"]): LoopDefinition | undefined {
    return this.loops.find((l) => l.id === id);
  }
  list(domain?: string): LoopDefinition[] {
    return domain ? this.loops.filter((l) => l.domain === domain) : this.loops;
  }
}

export { createLoopEngine } from "@loop-engine/runtime";
export { LoopBuilder } from "@loop-engine/dsl";
export { guardRegistry };
export { createSignalEngine } from "@loop-engine/signals";
export { InMemoryEventBus } from "@loop-engine/events";
export { computeMetrics, buildTimeline } from "@loop-engine/observability";
export type { LoopDefinition, LoopInstance, TransitionRecord, Signal } from "@loop-engine/core";

export function createLoopSystem(options: {
  loops: LoopDefinition[];
  store?: LoopStore;
  guards?: GuardRegistry;
  signals?: boolean;
}): {
  engine: LoopEngine;
  signals?: SignalEngine;
  eventBus: InMemoryEventBus;
} {
  const store = options.store ?? memoryStore();
  const eventBus = new InMemoryEventBus();
  const guardEvaluator = (options.guards ?? guardRegistry).createEvaluator();
  const engine = createLoopEngine({
    registry: new InMemoryLoopRegistry(options.loops),
    store,
    eventBus,
    guardEvaluator
  });
  return {
    engine,
    eventBus,
    ...(options.signals ? { signals: createSignalEngine() } : {})
  };
}
