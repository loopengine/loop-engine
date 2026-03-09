// @license MIT
// SPDX-License-Identifier: MIT
import type { LoopId, Signal, StateId, TransitionId } from "@loop-engine/core";
import type { LoopEvent } from "@loop-engine/events";

export interface SignalDetectionResult {
  signalType: string;
  subject: string;
  confidence: number;
  payload: Record<string, unknown>;
  triggeredTransition?: TransitionId;
}

export interface SignalRule {
  id: string;
  name: string;
  description: string;
  targetLoopId?: LoopId;
  evaluate: (events: LoopEvent[]) => SignalDetectionResult | null;
}

export interface SignalEngine {
  registerRule(rule: SignalRule): void;
  process(events: LoopEvent[]): Signal[];
  subscribe(handler: (signal: Signal) => void): () => void;
}

export type ThresholdRuleConfig = {
  field: string;
  operator: "lt" | "gt" | "lte" | "gte";
  threshold: number;
};

export type StateDwellRuleConfig = {
  state: StateId;
  maxDwellMinutes: number;
};

export type RepeatedGuardFailureConfig = {
  guardId: string;
  maxFailures: number;
};

export type LoopNotStartedConfig = {
  maxDelayMinutes: number;
};
