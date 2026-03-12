// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { memoryStore } from "@loop-engine/adapter-memory";
import type { LoopDefinition } from "@loop-engine/core";
import { LoopBuilder } from "@loop-engine/dsl";
import { InMemoryEventBus } from "@loop-engine/events";
import { defaultRegistry as guardRegistry, type GuardRegistry } from "@loop-engine/guards";
import { computeMetrics, buildTimeline } from "@loop-engine/observability";
import { httpRegistry, localRegistry, type LoopRegistry } from "@loop-engine/registry-client";
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
export { localRegistry, httpRegistry } from "@loop-engine/registry-client";
export type { LoopRegistry, LocalRegistryOptions, HttpRegistryOptions } from "@loop-engine/registry-client";
export type { LoopDefinition, LoopInstance, TransitionRecord, Signal } from "@loop-engine/core";

export interface CreateLoopSystemOptions {
  loops: LoopDefinition[];
  store?: LoopStore;
  guards?: GuardRegistry;
  signals?: boolean;
  /**
   * Optional loop registry to load additional loop definitions from.
   * Definitions are fetched at startup via registry.list().
   * Any loops passed in the loops[] array take precedence over
   * registry definitions with the same id (local wins).
   */
  registry?: LoopRegistry;
}

function mergeDefinitions(registryLoops: LoopDefinition[], localLoops: LoopDefinition[]): LoopDefinition[] {
  const merged = new Map<string, LoopDefinition>();
  for (const definition of registryLoops) {
    merged.set(String(definition.id), definition);
  }
  for (const definition of localLoops) {
    merged.set(String(definition.id), definition);
  }
  return [...merged.values()];
}

async function loadFromRegistry(registry: LoopRegistry): Promise<LoopDefinition[]> {
  return registry.list();
}

export async function createLoopSystem(options: CreateLoopSystemOptions): Promise<{
  engine: LoopEngine;
  signals?: SignalEngine;
  eventBus: InMemoryEventBus;
}> {
  let registryLoops: LoopDefinition[] = [];
  if (options.registry) {
    try {
      registryLoops = await loadFromRegistry(options.registry);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.warn(
        `createLoopSystem: failed to load loops from registry, falling back to local loops[] only (${message})`
      );
      registryLoops = [];
    }
  }

  const mergedLoops = mergeDefinitions(registryLoops, options.loops ?? []);
  const store = options.store ?? memoryStore();
  const eventBus = new InMemoryEventBus();
  const guardEvaluator = (options.guards ?? guardRegistry).createEvaluator();
  const engine = createLoopEngine({
    registry: new InMemoryLoopRegistry(mergedLoops),
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
