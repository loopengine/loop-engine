// @license MIT
// SPDX-License-Identifier: MIT
import type {
  ActorRef,
  AggregateId,
  CorrelationId,
  Evidence,
  GuardId,
  LoopId,
  OutcomeId,
  StateId,
  TransitionId
} from "@loopengine/core";

export interface LoopEventBase {
  eventId: string;
  loopId: LoopId;
  aggregateId: AggregateId;
  orgId: string;
  occurredAt: string;
  correlationId: CorrelationId;
  causationId?: string;
}

export interface LoopStartedEvent extends LoopEventBase {
  type: "loop.started";
  initialState: StateId;
  actor: ActorRef;
}

export interface TransitionExecutedEvent extends LoopEventBase {
  type: "loop.transition.executed";
  fromState: StateId;
  toState: StateId;
  transitionId: TransitionId;
  actor: ActorRef;
  evidence: Evidence;
  durationMs?: number;
}

export interface GuardFailedEvent extends LoopEventBase {
  type: "loop.guard.failed";
  fromState: StateId;
  attemptedTransitionId: TransitionId;
  guardId: GuardId;
  guardFailureMessage: string;
  severity?: "hard" | "soft";
  actor: ActorRef;
}

export interface LoopCompletedEvent extends LoopEventBase {
  type: "loop.completed";
  terminalState: StateId;
  actor: ActorRef;
  durationMs: number;
  transitionCount: number;
  outcomeId: OutcomeId;
  valueUnit: string;
}

export type LoopEvent =
  | LoopStartedEvent
  | TransitionExecutedEvent
  | GuardFailedEvent
  | LoopCompletedEvent;

