// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type {
  ActorRef,
  AggregateId,
  LoopId,
  LoopStatus,
  SignalId,
  StateId,
  TransitionId
} from "./schemas";

/**
 * A runtime-materialized loop instance: the per-aggregate record of where
 * a loop currently is and how it got there. Stored by `LoopStore`
 * implementations; produced and consumed by `LoopEngine`.
 *
 * This is the post-`1.0.0-rc.0` canonical name (formerly
 * `RuntimeLoopInstance`). The `Runtime` prefix was dropped per
 * MECHANICAL 8.5 / D-07 ("no dual names anywhere").
 */
export interface LoopInstance {
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

/**
 * A single transition that the engine recorded for a given aggregate.
 * Stored by `LoopStore` implementations; produced by `LoopEngine` whenever
 * a transition fires.
 *
 * This is the post-`1.0.0-rc.0` canonical name (formerly
 * `RuntimeTransitionRecord`). The `Runtime` prefix was dropped per
 * MECHANICAL 8.5 / D-07 ("no dual names anywhere").
 */
export interface TransitionRecord {
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
