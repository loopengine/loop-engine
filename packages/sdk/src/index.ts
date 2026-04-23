// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { memoryStore } from "@loop-engine/adapter-memory";
import type { LoopDefinition } from "@loop-engine/core";
import { InMemoryEventBus } from "@loop-engine/events";
import { GuardRegistry } from "@loop-engine/guards";
import { httpRegistry, localRegistry, type LoopRegistry } from "@loop-engine/registry-client";
import { createLoopEngine, type LoopDefinitionRegistry, type LoopStore, type LoopEngine } from "@loop-engine/runtime";
import { SignalRegistry } from "@loop-engine/signals";
import { validateLoopDefinition } from "@loop-engine/loop-definition";

// Local SDK surface (local files).
export { createAIActor } from "./ai";
export type { AIActor, AIActorConfig, AIProvider } from "./ai";
export { redactPiiEvidence } from "./lib/redactPiiEvidence";

// @loop-engine/core — explicit named re-exports per R-164 (replaces export *).
// All symbols enumerated here are part of the 1.0.0-rc.0 public surface per
// API_SURFACE_SPEC_DRAFT.md §1/§2; nothing here is in §4.
export type {
  AIAgentActor,
  AIAgentSubmission,
  ActorAdapter,
  ActorId,
  ActorRef,
  ActorType,
  AdapterChunk,
  AdapterInput,
  AdapterInputMetadata,
  AdapterOutput,
  AggregateId,
  BusinessMetric,
  CorrelationId,
  EvidenceRecord,
  EvidenceValue,
  GuardEvidenceOptions,
  GuardId,
  GuardSeverity,
  GuardSpec,
  LoopActorPromptContext,
  LoopActorPromptSignal,
  LoopDefinition,
  LoopId,
  LoopInstance,
  LoopStatus,
  OutcomeId,
  OutcomeSpec,
  SearchRecencyFilter,
  SignalId,
  StateId,
  StateSpec,
  ToolAdapter,
  TransitionId,
  TransitionRecord,
  TransitionSpec
} from "@loop-engine/core";
export {
  ActorIdSchema,
  ActorRefSchema,
  ActorTypeSchema,
  AggregateIdSchema,
  BusinessMetricSchema,
  CorrelationIdSchema,
  GuardIdSchema,
  GuardSeveritySchema,
  GuardSpecSchema,
  LoopDefinitionSchema,
  LoopIdSchema,
  LoopStatusSchema,
  OutcomeIdSchema,
  OutcomeSpecSchema,
  SignalIdSchema,
  StateIdSchema,
  StateSpecSchema,
  TransitionIdSchema,
  TransitionSpecSchema,
  actorId,
  aggregateId,
  guardEvidence,
  guardId,
  loopId,
  signalId,
  stateId,
  transitionId
} from "@loop-engine/core";

// @loop-engine/actors — explicit named re-exports per R-164.
export type {
  AIActorConstraints,
  AIActorDecision,
  Actor,
  ActorAuthorizationResult,
  ActorDecisionErrorCode,
  AutomationActor,
  HumanActor,
  SystemActor
} from "@loop-engine/actors";
export {
  AIAgentActorSchema,
  ActorDecisionError,
  AutomationActorSchema,
  HumanActorSchema,
  SystemActorSchema,
  buildAIActorEvidence,
  canActorExecuteTransition
} from "@loop-engine/actors";

// @loop-engine/events — explicit named re-exports per R-164. The nine
// `createLoop*Event` factories are omitted per D-17 (internal only;
// spec §4 "Internal: createLoop*Event factories").
export type {
  LearningSignal,
  LoopCancelledEvent,
  LoopCompletedEvent,
  LoopDefinitionLike,
  LoopEvent,
  LoopEventBase,
  LoopEventType,
  LoopFailedEvent,
  LoopGuardFailedEvent,
  LoopSignalReceivedEvent,
  LoopStartedEvent,
  LoopTransitionBlockedEvent,
  LoopTransitionExecutedEvent,
  LoopTransitionRequestedEvent
} from "@loop-engine/events";
export {
  BaseLoopEventSchema,
  InMemoryEventBus,
  LOOP_EVENT_TYPES,
  LoopCancelledEventSchema,
  LoopCompletedEventSchema,
  LoopEventSchema,
  LoopFailedEventSchema,
  LoopGuardFailedEventSchema,
  LoopSignalReceivedEventSchema,
  LoopStartedEventSchema,
  LoopTransitionBlockedEventSchema,
  LoopTransitionExecutedEventSchema,
  LoopTransitionRequestedEventSchema,
  extractLearningSignal
} from "@loop-engine/events";

// @loop-engine/guards — explicit named re-exports per R-164.
export type {
  EvaluateGuardsFn,
  GuardContext,
  GuardEvaluationResult,
  GuardEvaluationSummary,
  GuardEvaluator,
  GuardResult
} from "@loop-engine/guards";
export {
  ConfidenceThresholdGuard,
  CooldownGuard,
  EvidenceRequiredGuard,
  GuardRegistry,
  HumanOnlyGuard,
  createGuardRegistry,
  defaultRegistry,
  evaluateGuards
} from "@loop-engine/guards";

// @loop-engine/signals — explicit named re-exports per R-164.
export type { SignalPayload, SignalSpec } from "@loop-engine/signals";
export { SignalRegistry } from "@loop-engine/signals";

// @loop-engine/observability — already explicit.
export { computeMetrics, buildTimeline } from "@loop-engine/observability";

// @loop-engine/registry-client — already explicit.
export { localRegistry, httpRegistry } from "@loop-engine/registry-client";
export type { LoopRegistry, LocalRegistryOptions, HttpRegistryOptions } from "@loop-engine/registry-client";

// @loop-engine/adapter-memory — already explicit.
export { memoryStore };

// @loop-engine/runtime — already explicit.
export type { LoopStore, LoopEngine } from "@loop-engine/runtime";

// @loop-engine/loop-definition — D-19 ship list. `parseLoopJson` and
// `serializeLoopJson` added to the root barrel per D-19 (they were
// previously reachable only via the now-removed `/dsl` subpath).
// `applyAuthoringDefaults` is intentionally NOT re-exported — it is an
// internal helper consumed by `@loop-engine/registry-client`, never on
// D-19's public ship list (spec §4 "Internal: applyAuthoringDefaults").
export { LoopBuilder } from "@loop-engine/loop-definition";
export type {
  LoopBuilderGuardInput,
  LoopBuilderOutcomeInput,
  LoopBuilderTransitionInput
} from "@loop-engine/loop-definition";
export {
  parseLoopYaml,
  parseLoopYamlSafe,
  serializeLoopYaml,
  parseLoopJson,
  serializeLoopJson
} from "@loop-engine/loop-definition";
export { validateLoopDefinition };
export type { ValidationError, ValidationResult } from "@loop-engine/loop-definition";

class InMemoryLoopRegistry implements LoopDefinitionRegistry {
  constructor(private readonly loops: LoopDefinition[]) {}

  get(id: LoopDefinition["id"]): LoopDefinition | undefined {
    return this.loops.find((loop) => loop.id === id);
  }

  list(): LoopDefinition[] {
    return this.loops;
  }
}

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
      throw new Error(`Invalid loop definition ${definition.id}: ${detail}`);
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
