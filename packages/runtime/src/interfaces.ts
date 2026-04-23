// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type {
  AggregateId,
  LoopDefinition,
  LoopId,
  LoopInstance,
  TransitionRecord
} from "@loop-engine/core";
import type { LoopEvent } from "@loop-engine/events";
import type { GuardRegistry } from "@loop-engine/guards";

export interface LoopStore {
  getInstance(aggregateId: AggregateId): Promise<LoopInstance | null>;
  saveInstance(instance: LoopInstance): Promise<void>;
  getTransitionHistory(aggregateId: AggregateId): Promise<TransitionRecord[]>;
  saveTransitionRecord(record: TransitionRecord): Promise<void>;
  listOpenInstances(loopId: LoopId): Promise<LoopInstance[]>;
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
