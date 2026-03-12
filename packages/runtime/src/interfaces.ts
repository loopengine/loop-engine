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

export interface LoopStorageAdapter {
  getLoop(aggregateId: AggregateId): Promise<RuntimeLoopInstance | null>;
  createLoop(instance: RuntimeLoopInstance): Promise<void>;
  updateLoop(instance: RuntimeLoopInstance): Promise<void>;
  appendTransition(record: RuntimeTransitionRecord): Promise<void>;
  getTransitions(aggregateId: AggregateId): Promise<RuntimeTransitionRecord[]>;
  listOpenLoops(loopId: LoopId): Promise<RuntimeLoopInstance[]>;
}

export interface LoopDefinitionRegistry {
  get(loopId: LoopId): LoopDefinition | undefined;
  list(): LoopDefinition[];
}

export interface EventBus {
  emit(event: LoopEvent): Promise<void>;
}

export interface LoopSystemOptions {
  registry: LoopDefinitionRegistry;
  storage: LoopStorageAdapter;
  eventBus?: EventBus;
  guardRegistry?: GuardRegistry;
  now?: () => string;
}
