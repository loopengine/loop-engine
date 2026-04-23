// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type {
  ActorRef,
  AggregateId,
  LoopDefinition,
  LoopId,
  LoopStatus,
  SignalId,
  StateId,
  TransitionId
} from "@loop-engine/core";
import type { LoopEvent } from "@loop-engine/events";
import type { GuardRegistry } from "@loop-engine/guards";

export interface RuntimeLoopInstance {
  loopId: LoopId;
  aggregateId: AggregateId;
  currentState: StateId;
  status: LoopStatus;
  startedAt: string;
  updatedAt: string;
  correlationId?: string | undefined;
  completedAt?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface RuntimeTransitionRecord {
  aggregateId: AggregateId;
  loopId: LoopId;
  transitionId: TransitionId;
  signal: SignalId;
  fromState: StateId;
  toState: StateId;
  actor: ActorRef;
  occurredAt: string;
  evidence?: Record<string, unknown> | undefined;
}

export interface LoopStore {
  getInstance(aggregateId: AggregateId): Promise<RuntimeLoopInstance | null>;
  saveInstance(instance: RuntimeLoopInstance): Promise<void>;
  getTransitionHistory(aggregateId: AggregateId): Promise<RuntimeTransitionRecord[]>;
  saveTransitionRecord(record: RuntimeTransitionRecord): Promise<void>;
  listOpenInstances(loopId: LoopId): Promise<RuntimeLoopInstance[]>;
}

export interface LoopDefinitionRegistry {
  get(loopId: LoopId): LoopDefinition | undefined;
  list(): LoopDefinition[];
}

export interface EventBus {
  emit(event: LoopEvent): Promise<void>;
  /**
   * Optional handler subscription. Implementations that broadcast events
   * (e.g. `InMemoryEventBus`) implement this; one-way emitters
   * (e.g. `httpEventBus`, `kafkaEventBus`) may omit it.
   */
  subscribe?(handler: (event: LoopEvent) => Promise<void>): () => void;
}

export interface LoopEngineOptions {
  registry: LoopDefinitionRegistry;
  store: LoopStore;
  eventBus?: EventBus;
  guardRegistry?: GuardRegistry;
  now?: () => string;
}
