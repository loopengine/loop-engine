// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type {
  ActorRef,
  AggregateId,
  CorrelationId,
  Evidence,
  GuardId,
  LoopId,
  OutcomeId,
  Signal,
  StateId,
  TransitionId,
  TransitionRecord
} from "@loop-engine/core";

export const LOOP_EVENT_TYPES = {
  LOOP_STARTED: "loop.started",
  TRANSITION_REQUESTED: "loop.transition.requested",
  TRANSITION_EXECUTED: "loop.transition.executed",
  TRANSITION_BLOCKED: "loop.transition.blocked",
  GUARD_FAILED: "loop.guard.failed",
  LOOP_COMPLETED: "loop.completed",
  LOOP_ERROR: "loop.error",
  LOOP_SPAWNED: "loop.spawned",
  SIGNAL_RECEIVED: "loop.signal.received",
  OUTCOME_RECORDED: "loop.outcome.recorded"
} as const;

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
  type: typeof LOOP_EVENT_TYPES.LOOP_STARTED;
  initialState: StateId;
  actor: ActorRef;
}

export interface TransitionRequestedEvent extends LoopEventBase {
  type: typeof LOOP_EVENT_TYPES.TRANSITION_REQUESTED;
  transitionId: TransitionId;
  actor: ActorRef;
  evidence: Evidence;
  requestedAt: string;
}

export interface TransitionExecutedEvent extends LoopEventBase {
  type: typeof LOOP_EVENT_TYPES.TRANSITION_EXECUTED;
  fromState: StateId;
  toState: StateId;
  transitionId: TransitionId;
  actor: ActorRef;
  evidence: Evidence;
  durationMs?: number;
}

export interface TransitionBlockedEvent extends LoopEventBase {
  type: typeof LOOP_EVENT_TYPES.TRANSITION_BLOCKED;
  transitionId: TransitionId;
  reason: "guard_failed" | "unauthorized_actor" | "invalid_transition" | "loop_closed";
  actor: ActorRef;
  guardFailures?: { guardId: GuardId; message: string }[];
}

export interface GuardFailedEvent extends LoopEventBase {
  type: typeof LOOP_EVENT_TYPES.GUARD_FAILED;
  fromState: StateId;
  attemptedTransitionId: TransitionId;
  guardId: GuardId;
  guardFailureMessage: string;
  severity?: "hard" | "soft";
  actor: ActorRef;
}

export interface LoopCompletedEvent extends LoopEventBase {
  type: typeof LOOP_EVENT_TYPES.LOOP_COMPLETED;
  terminalState: StateId;
  actor: ActorRef;
  durationMs: number;
  transitionCount: number;
  outcomeId: OutcomeId;
  valueUnit: string;
}

export interface LoopErrorEvent extends LoopEventBase {
  type: typeof LOOP_EVENT_TYPES.LOOP_ERROR;
  errorState: StateId;
  errorCode: string;
  errorMessage: string;
  actor: ActorRef;
}

export interface LoopSpawnedEvent extends LoopEventBase {
  type: typeof LOOP_EVENT_TYPES.LOOP_SPAWNED;
  parentAggregateId: AggregateId;
  childLoopId: LoopId;
  childAggregateId: AggregateId;
}

export interface SignalReceivedEvent extends LoopEventBase {
  type: typeof LOOP_EVENT_TYPES.SIGNAL_RECEIVED;
  signalType: string;
  confidence: number;
  triggeredLoopId?: LoopId;
}

export interface OutcomeRecordedEvent extends LoopEventBase {
  type: typeof LOOP_EVENT_TYPES.OUTCOME_RECORDED;
  outcomeId: OutcomeId;
  valueUnit: string;
  businessMetrics?: Record<string, unknown>;
  durationMs: number;
}

export type LoopEvent =
  | LoopStartedEvent
  | TransitionRequestedEvent
  | TransitionExecutedEvent
  | TransitionBlockedEvent
  | GuardFailedEvent
  | LoopCompletedEvent
  | LoopErrorEvent
  | LoopSpawnedEvent
  | SignalReceivedEvent
  | OutcomeRecordedEvent;

export interface LearningSignal {
  loopId: LoopId;
  aggregateId: AggregateId;
  outcomeId: OutcomeId;
  predicted: Record<string, unknown>;
  actual: Record<string, unknown>;
  delta: Record<string, number>;
  occurredAt: string;
  confidence?: number;
}

export function extractLearningSignal(
  completed: LoopCompletedEvent,
  history: TransitionRecord[],
  predicted?: Record<string, unknown>
): LearningSignal {
  const actual: Record<string, unknown> = {};
  const startedAt = history[0]?.occurredAt;
  if (startedAt) {
    const durationDays =
      (Date.parse(completed.occurredAt) - Date.parse(startedAt)) / (1000 * 60 * 60 * 24);
    actual.cycle_time_days = Number(durationDays.toFixed(3));
  }

  const delta: Record<string, number> = {};
  for (const [k, v] of Object.entries(predicted ?? {})) {
    const av = actual[k];
    if (typeof v === "number" && typeof av === "number") {
      delta[k] = av - v;
    }
  }

  return {
    loopId: completed.loopId,
    aggregateId: completed.aggregateId,
    outcomeId: completed.outcomeId,
    predicted: predicted ?? {},
    actual,
    delta,
    occurredAt: completed.occurredAt
  };
}
