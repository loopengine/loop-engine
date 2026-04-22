// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type {
  ActorRef,
  ActorType,
  AggregateId,
  GuardId,
  GuardSeverity,
  LoopDefinition,
  LoopId,
  SignalId,
  StateId,
  TransitionId
} from "@loop-engine/core";
import type { LoopEventBase } from "./base";

export interface LoopStartedEvent extends LoopEventBase {
  type: "loop.started";
  initialState: StateId;
  actor: ActorRef;
  definition: { loopId: LoopId; version: string; name: string };
}

export interface LoopCompletedEvent extends LoopEventBase {
  type: "loop.completed";
  finalState: StateId;
  actor: ActorRef;
  durationMs: number;
  outcome?: { valueUnit: string; metrics: Record<string, unknown> } | undefined;
}

export interface LoopCancelledEvent extends LoopEventBase {
  type: "loop.cancelled";
  fromState: StateId;
  actor: ActorRef;
  reason?: string | undefined;
}

export interface LoopFailedEvent extends LoopEventBase {
  type: "loop.failed";
  fromState: StateId;
  error: { code: string; message: string; stack?: string | undefined };
}

export interface LoopTransitionRequestedEvent extends LoopEventBase {
  type: "loop.transition.requested";
  transitionId: TransitionId;
  fromState: StateId;
  toState: StateId;
  signal: SignalId;
  actor: ActorRef;
  evidence?: Record<string, unknown> | undefined;
}

export interface LoopTransitionExecutedEvent extends LoopEventBase {
  type: "loop.transition.executed";
  transitionId: TransitionId;
  fromState: StateId;
  toState: StateId;
  signal: SignalId;
  actor: ActorRef;
  evidence?: Record<string, unknown> | undefined;
  softGuardWarnings?: Array<{ guardId: GuardId; message: string }> | undefined;
}

export interface LoopTransitionBlockedEvent extends LoopEventBase {
  type: "loop.transition.blocked";
  transitionId: TransitionId;
  fromState: StateId;
  attemptedToState: StateId;
  actor: ActorRef;
  guardFailures: Array<{ guardId: GuardId; message: string }>;
}

export interface LoopGuardFailedEvent extends LoopEventBase {
  type: "loop.guard.failed";
  transitionId: TransitionId;
  fromState: StateId;
  guardId: GuardId;
  severity: GuardSeverity;
  actor: ActorRef;
  message: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface LoopSignalReceivedEvent extends LoopEventBase {
  type: "loop.signal.received";
  signal: SignalId;
  fromState: StateId;
  actor: ActorRef;
  payload?: Record<string, unknown> | undefined;
}

export type LoopEvent =
  | LoopStartedEvent
  | LoopCompletedEvent
  | LoopCancelledEvent
  | LoopFailedEvent
  | LoopTransitionRequestedEvent
  | LoopTransitionExecutedEvent
  | LoopTransitionBlockedEvent
  | LoopGuardFailedEvent
  | LoopSignalReceivedEvent;

export const LOOP_EVENT_TYPES = [
  "loop.started",
  "loop.completed",
  "loop.cancelled",
  "loop.failed",
  "loop.transition.requested",
  "loop.transition.executed",
  "loop.transition.blocked",
  "loop.guard.failed",
  "loop.signal.received"
] as const satisfies ReadonlyArray<LoopEvent["type"]>;

export type LoopEventType = (typeof LOOP_EVENT_TYPES)[number];

export interface LearningSignal {
  loopId: LoopId;
  aggregateId: AggregateId;
  loopName: string;
  completedAt: string;
  durationMs: number;
  transitionCount: number;
  businessMetricIds: string[];
  predicted?: Record<string, number>;
  actual?: Record<string, number>;
  delta?: Record<string, number>;
  actorSummary: Array<{ actorType: ActorType; transitionCount: number }>;
}

export type LoopDefinitionLike = Pick<LoopDefinition, "loopId" | "name" | "outcome">;
