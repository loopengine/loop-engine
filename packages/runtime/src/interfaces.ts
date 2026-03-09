// @license MIT
// SPDX-License-Identifier: MIT
import type {
  ActorRef,
  AggregateId,
  Evidence,
  GuardId,
  LoopId,
  LoopInstance,
  LoopRegistry,
  StateId,
  TransitionId,
  TransitionRecord
} from "@loop-engine/core";
import type { LoopEvent } from "@loop-engine/events";

export interface LoopStore {
  getInstance(aggregateId: AggregateId): Promise<LoopInstance | null>;
  saveInstance(instance: LoopInstance): Promise<void>;
  getTransitionHistory(aggregateId: AggregateId): Promise<TransitionRecord[]>;
  saveTransitionRecord(record: TransitionRecord): Promise<void>;
  listOpenInstances(loopId: LoopId, orgId: string): Promise<LoopInstance[]>;
}

export interface EventBus {
  emit(event: LoopEvent): Promise<void>;
  subscribe(handler: (event: LoopEvent) => Promise<void>): () => void;
}

export interface GuardContext {
  loopId: LoopId;
  aggregateId: AggregateId;
  transitionId: TransitionId;
  actor: ActorRef;
  evidence: Evidence;
  currentState: StateId;
  instance: LoopInstance;
}

export interface GuardResult {
  passed: boolean;
  code?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface GuardEvaluator {
  evaluate(guardId: GuardId, context: GuardContext): Promise<GuardResult>;
}

export interface LoopEngineOptions {
  registry: LoopRegistry;
  store: LoopStore;
  eventBus?: EventBus;
  guardEvaluator?: GuardEvaluator;
  clock?: () => string;
}
