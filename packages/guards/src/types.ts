// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type {
  ActorRef,
  AggregateId,
  GuardId,
  GuardSeverity,
  GuardSpec,
  LoopId,
  SignalId,
  StateId
} from "@loop-engine/core";

export interface GuardContext {
  actor: ActorRef;
  loopId: LoopId;
  aggregateId: AggregateId;
  fromState: StateId;
  toState: StateId;
  signal: SignalId;
  evidence?: Record<string, unknown>;
  loopData?: Record<string, unknown>;
}

export interface GuardResult {
  passed: boolean;
  code?: string | undefined;
  message?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface GuardEvaluator {
  evaluate(context: GuardContext, parameters?: Record<string, unknown>): Promise<GuardResult>;
}

export interface GuardEvaluationResult {
  guardId: GuardId;
  severity: GuardSeverity;
  passed: boolean;
  code?: string | undefined;
  message: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface GuardEvaluationSummary {
  hardFailures: GuardEvaluationResult[];
  softFailures: GuardEvaluationResult[];
  allPassed: boolean;
}

export type EvaluateGuardsFn = (
  guards: GuardSpec[],
  context: GuardContext
) => Promise<GuardEvaluationSummary>;
