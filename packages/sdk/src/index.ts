// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { memoryStore } from "@loop-engine/adapter-memory";
import type { LoopDefinition } from "@loop-engine/core";
import { InMemoryEventBus } from "@loop-engine/events";
import { GuardRegistry } from "@loop-engine/guards";
import { computeMetrics, buildTimeline } from "@loop-engine/observability";
import { httpRegistry, localRegistry, type LoopRegistry } from "@loop-engine/registry-client";
import {
  createLoopEngine,
  type LoopDefinitionRegistry,
  type LoopStore,
  type LoopEngine
} from "@loop-engine/runtime";
import { SignalRegistry } from "@loop-engine/signals";
import { validateLoopDefinition } from "@loop-engine/loop-definition";
export { createAIActor } from "./ai";
export type { AIActor, AIActorConfig, AIProvider } from "./ai";
export { guardEvidence } from "./lib/guardEvidence";
export type { EvidenceRecord } from "./lib/guardEvidence";

class InMemoryLoopRegistry implements LoopDefinitionRegistry {
  constructor(private readonly loops: LoopDefinition[]) {}

  get(id: LoopDefinition["loopId"]): LoopDefinition | undefined {
    return this.loops.find((loop) => loop.loopId === id);
  }

  list(): LoopDefinition[] {
    return this.loops;
  }
}

export { InMemoryEventBus } from "@loop-engine/events";
export { computeMetrics, buildTimeline } from "@loop-engine/observability";
export { localRegistry, httpRegistry } from "@loop-engine/registry-client";
export type { LoopRegistry, LocalRegistryOptions, HttpRegistryOptions } from "@loop-engine/registry-client";
export { memoryStore };
export { GuardRegistry };
export { SignalRegistry };
export type {
  RuntimeLoopInstance,
  RuntimeTransitionRecord,
  LoopStore,
  LoopEngine
} from "@loop-engine/runtime";

// Core types — always re-exported from sdk
export * from "@loop-engine/core";

// LoopBuilder, parser, serializer, validator — implementation lives in @loop-engine/loop-definition (shared with registry-client)
export { LoopBuilder } from "@loop-engine/loop-definition";
export type {
  LoopBuilderGuardInput,
  LoopBuilderGuardLegacy,
  LoopBuilderGuardShorthand,
  LoopBuilderOutcomeInput,
  LoopBuilderTransitionInput
} from "@loop-engine/loop-definition";
export { parseLoopYaml, parseLoopYamlSafe, serializeLoopYaml } from "@loop-engine/loop-definition";
export { validateLoopDefinition };
export type { ValidationError, ValidationResult } from "@loop-engine/loop-definition";

export * from "@loop-engine/guards";
export * from "@loop-engine/actors";
export * from "@loop-engine/events";
export * from "@loop-engine/signals";

export interface CreateLoopSystemOptions {
  loops: LoopDefinition[];
  store?: LoopStore;
  guards?: GuardRegistry;
  signals?: boolean;
  /**
   * Optional loop registry to load additional loop definitions from.
   * Definitions are fetched at startup via registry.list().
   * Any loops passed in loops[] take precedence over registry definitions
   * with the same loopId (local wins).
   */
  registry?: LoopRegistry;
}

function mergeDefinitions(registryLoops: LoopDefinition[], localLoops: LoopDefinition[]): LoopDefinition[] {
  const merged = new Map<string, LoopDefinition>();
  for (const definition of registryLoops) {
    merged.set(String(definition.loopId), definition);
  }
  for (const definition of localLoops) {
    merged.set(String(definition.loopId), definition);
  }
  return [...merged.values()];
}

async function loadFromRegistry(registry: LoopRegistry): Promise<LoopDefinition[]> {
  return registry.list();
}

export async function createLoopSystem(options: CreateLoopSystemOptions): Promise<{
  engine: LoopEngine;
  store: LoopStore;
  signals?: SignalRegistry;
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
  for (const definition of mergedLoops) {
    const validation = validateLoopDefinition(definition);
    if (!validation.valid) {
      const detail = validation.errors.map((error) => `${error.code}: ${error.message}`).join("; ");
      throw new Error(`Invalid loop definition ${definition.loopId}: ${detail}`);
    }
  }

  const store = options.store ?? memoryStore();
  const eventBus = new InMemoryEventBus();
  const guardRegistry = options.guards ?? new GuardRegistry();
  if (!options.guards) {
    guardRegistry.registerBuiltIns();
  }

  const engine = createLoopEngine({
    registry: new InMemoryLoopRegistry(mergedLoops),
    store,
    eventBus,
    guardRegistry
  });

  return {
    engine,
    store,
    eventBus,
    ...(options.signals ? { signals: new SignalRegistry() } : {})
  };
}
