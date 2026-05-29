// SPDX-License-Identifier: Apache-2.0
// Copyright © Loop Engine Contributors

import type { ActorRef, EvidenceRecord } from "@loop-engine/core";

export type TraceEventType =
  | "loop.started"
  | "transition.attempted"
  | "guard.evaluated"
  | "transition.completed"
  | "transition.blocked"
  | "loop.terminal";

export interface GuardTraceEntry {
  guardId: string;
  passed: boolean;
  reason: string;
  evaluatedAt: Date;
  durationMs: number;
}

export interface TraceRecord {
  id: string;
  loopRunId: string;
  loopId: string;
  sequence: number;
  timestamp: Date;
  type: TraceEventType;
  fromState: string | null;
  toState: string | null;
  transitionId: string | null;
  actor: ActorRef;
  /** SHA-256 hex of raw input — stored without PII for deduplication */
  inputHash: string;
  /** Input after guardEvidence() redaction — never raw */
  input: unknown;
  /** Output after guardEvidence() redaction — never raw */
  output: unknown;
  guards: GuardTraceEntry[];
  evidence: EvidenceRecord;
  durationMs: number;
  blocked: boolean;
  blockReason: string | null;
  /** True when this run had a traceStore + guard registry active */
  governed: boolean;
  tenantId: string;
}

export interface RunSummary {
  loopRunId: string;
  loopId: string;
  startedAt: Date;
  completedAt: Date | null;
  terminalState: string | null;
  stepCount: number;
  blockedCount: number;
  governed: boolean;
  tenantId: string;
}

export interface ComparedStep {
  sequence: number;
  inA: TraceRecord | null;
  inB: TraceRecord | null;
  equivalent: boolean;
}

export interface RunComparison {
  runA: RunSummary;
  runB: RunSummary;
  steps: ComparedStep[];
  /** Sequence number where runs first diverge, or null if identical */
  divergencePoint: number | null;
}

export interface ListRunsOpts {
  limit?: number;
  after?: Date;
  before?: Date;
  governed?: boolean;
}
