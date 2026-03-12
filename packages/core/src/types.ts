// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

export type LoopId = string & { readonly __brand: "LoopId" };
export type AggregateId = string & { readonly __brand: "AggregateId" };
export type ActorId = string & { readonly __brand: "ActorId" };
export type SignalId = string & { readonly __brand: "SignalId" };
export type GuardId = string & { readonly __brand: "GuardId" };
export type StateId = string & { readonly __brand: "StateId" };
export type TransitionId = string & { readonly __brand: "TransitionId" };

export type LoopStatus =
  | "pending"
  | "active"
  | "completed"
  | "failed"
  | "cancelled"
  | "suspended";

export type ActorType = "human" | "automation" | "ai-agent";

export interface ActorRef {
  id: ActorId;
  type: ActorType;
  displayName?: string;
  metadata?: Record<string, unknown>;
}

export type GuardSeverity = "hard" | "soft";

export interface GuardSpec {
  guardId: GuardId;
  description: string;
  severity: GuardSeverity;
  evaluatedBy: "runtime" | "module" | "external";
  parameters?: Record<string, unknown>;
}

export interface TransitionSpec {
  transitionId: TransitionId;
  from: StateId;
  to: StateId;
  signal: SignalId;
  allowedActors: ActorType[];
  guards?: GuardSpec[];
  description?: string;
}

export interface StateSpec {
  stateId: StateId;
  label: string;
  terminal?: boolean;
  description?: string;
}

export interface BusinessMetric {
  id: string;
  label: string;
  unit: string;
  improvableByAI?: boolean;
}

export interface OutcomeSpec {
  description: string;
  valueUnit: string;
  businessMetrics: BusinessMetric[];
}

export interface LoopDefinition {
  loopId: LoopId;
  version: string;
  name: string;
  description: string;
  states: StateSpec[];
  initialState: StateId;
  transitions: TransitionSpec[];
  outcome?: OutcomeSpec;
  tags?: string[];
}
