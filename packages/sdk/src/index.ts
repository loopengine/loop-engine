// @license MIT
// SPDX-License-Identifier: MIT
import { memoryStore } from "@loopengine/adapter-memory";
import type { LoopDefinition } from "@loopengine/core";
import { LoopBuilder } from "@loopengine/dsl";
import { InMemoryEventBus } from "@loopengine/events";
import { defaultRegistry as guardRegistry, type GuardRegistry } from "@loopengine/guards";
import { computeMetrics, buildTimeline } from "@loopengine/observability";
import { createLoopEngine, type LoopEngine, type LoopStore } from "@loopengine/runtime";
import { createSignalEngine, type SignalEngine } from "@loopengine/signals";

class InMemoryLoopRegistry {
  constructor(private readonly loops: LoopDefinition[]) {}
  get(id: LoopDefinition["id"]): LoopDefinition | undefined {
    return this.loops.find((l) => l.id === id);
  }
  list(domain?: string): LoopDefinition[] {
    return domain ? this.loops.filter((l) => l.domain === domain) : this.loops;
  }
}

export { createLoopEngine } from "@loopengine/runtime";
export { LoopBuilder } from "@loopengine/dsl";
export { guardRegistry };
export { createSignalEngine } from "@loopengine/signals";
export { InMemoryEventBus } from "@loopengine/events";
export { computeMetrics, buildTimeline } from "@loopengine/observability";
export type { LoopDefinition, LoopInstance, TransitionRecord, Signal } from "@loopengine/core";

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
