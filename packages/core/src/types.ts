// @license MIT
// SPDX-License-Identifier: MIT

// Branded ID types for type safety
export type LoopId = string & { readonly __brand: "LoopId" };
export type StateId = string & { readonly __brand: "StateId" };
export type TransitionId = string & { readonly __brand: "TransitionId" };
export type AggregateId = string & { readonly __brand: "AggregateId" };
export type ActorId = string & { readonly __brand: "ActorId" };
export type GuardId = string & { readonly __brand: "GuardId" };
export type SignalId = string & { readonly __brand: "SignalId" };
export type OutcomeId = string & { readonly __brand: "OutcomeId" };
export type CorrelationId = string & { readonly __brand: "CorrelationId" };

// Helper to cast strings to branded types safely
export function loopId(s: string): LoopId {
  return s as LoopId;
}
export function stateId(s: string): StateId {
  return s as StateId;
}
export function transitionId(s: string): TransitionId {
  return s as TransitionId;
}
export function aggregateId(s: string): AggregateId {
  return s as AggregateId;
}
export function actorId(s: string): ActorId {
  return s as ActorId;
}
export function guardId(s: string): GuardId {
  return s as GuardId;
}
export function signalId(s: string): SignalId {
  return s as SignalId;
}
export function outcomeId(s: string): OutcomeId {
  return s as OutcomeId;
}
export function correlationId(s: string): CorrelationId {
  return s as CorrelationId;
}

export type ActorType = "human" | "automation" | "ai-agent" | "webhook" | "system";

export type LoopStatus = "OPEN" | "IN_PROGRESS" | "CLOSED" | "ERROR" | "CANCELLED";

export interface GuardSpec {
  id: GuardId;
  description: string;
  failureMessage: string;
  severity: "hard" | "soft";
  evaluatedBy: "runtime" | "module" | "external";
}

export interface BusinessMetric {
  id: string;
  label: string;
  unit: "boolean" | "days" | "units" | "currency" | "percentage" | string;
  improvableByAI: boolean;
}

export interface OutcomeSpec {
  id: OutcomeId;
  description: string;
  valueUnit: string;
  measurable: boolean;
  businessMetrics?: BusinessMetric[];
}

export interface SideEffectSpec {
  id: string;
  description: string;
  triggeredBy: TransitionId;
}

export interface TransitionSpec {
  id: TransitionId;
  from: StateId;
  to: StateId;
  allowedActors: ActorType[];
  guards?: GuardSpec[];
  sideEffects?: SideEffectSpec[];
  description?: string;
}

export interface StateSpec {
  id: StateId;
  description?: string;
  isTerminal?: boolean;
  isError?: boolean;
}

export interface LoopDefinition {
  id: LoopId;
  version: string;
  description: string;
  domain: string;
  states: StateSpec[];
  initialState: StateId;
  transitions: TransitionSpec[];
  outcome: OutcomeSpec;
  participants?: string[];
  spawnableLoops?: LoopId[];
  metadata?: Record<string, unknown>;
}

export interface LoopRegistry {
  get(loopId: LoopId): LoopDefinition | undefined;
  list(domain?: string): LoopDefinition[];
}

export interface ActorRef {
  type: ActorType;
  id: ActorId;
  displayName?: string;
  sessionId?: string;
  agentId?: string;
}

export interface Evidence {
  [key: string]: unknown;
}

export interface LoopInstance {
  loopId: LoopId;
  aggregateId: AggregateId;
  orgId: string;
  currentState: StateId;
  status: LoopStatus;
  startedAt: string;
  closedAt?: string;
  correlationId: CorrelationId;
  metadata?: Record<string, unknown>;
}

export interface TransitionRecord {
  id: string;
  loopId: LoopId;
  aggregateId: AggregateId;
  transitionId: TransitionId;
  fromState: StateId;
  toState: StateId;
  actor: ActorRef;
  evidence: Evidence;
  occurredAt: string;
  durationMs?: number;
}

export interface Signal {
  id: SignalId;
  type: string;
  subject: string;
  confidence?: number;
  observedAt: string;
  payload: Record<string, unknown>;
  triggeredLoopId?: LoopId;
}
