// SPDX-License-Identifier: Apache-2.0
// Copyright © Loop Engine Contributors

import type { TraceLoopMetrics } from "./trace-timeline.js";

/** Matches RT-01 freeze label in OpenAPI and runtime-api-contract-v1.md */
export const RUNTIME_API_CONTRACT_VERSION = "runtime-api-2026-05";

/** Serializable run summary for Studio / replay tooling */
export interface RunReadSummaryDto {
  loopRunId: string;
  loopId: string;
  startedAt: string;
  completedAt: string | null;
  terminalState: string | null;
  stepCount: number;
  blockedCount: number;
  governed: boolean;
}

/** Audit event aligned with aggregate `.../history` shape plus run sequence */
export interface RunAuditEventDto {
  eventId: string;
  sequence: number;
  type: string;
  fromState: string | null;
  toState: string | null;
  transitionId: string | null;
  actor: { id: string; type: string };
  evidence: Record<string, unknown>;
  occurredAt: string;
  blocked: boolean;
  blockReason: string | null;
}

export interface RunHistoryReadResponse {
  contractVersion: string;
  loopRunId: string;
  loopId: string;
  events: RunAuditEventDto[];
}

export interface RunEvidenceItemDto {
  sequence: number;
  eventId: string;
  transitionId: string | null;
  type: string;
  occurredAt: string;
  evidence: Record<string, unknown>;
}

export interface RunEvidenceReadResponse {
  contractVersion: string;
  loopRunId: string;
  loopId: string;
  items: RunEvidenceItemDto[];
}

export interface RunDetailReadResponse {
  contractVersion: string;
  run: RunReadSummaryDto;
  traceStepCount: number;
  readSurfaces: {
    history: string;
    evidence: string;
    timeline: string;
    replaySummary: string;
    /** Legacy raw trace array (RT-01) */
    legacyTrace: string;
  };
}

export interface RunReplaySummaryReadResponse {
  contractVersion: string;
  loopRunId: string;
  loopId: string;
  metrics: TraceLoopMetrics;
  transitionCount: number;
  guardBlockCount: number;
  humanApprovalCount: number;
  terminalState: string | null;
  sequenceValid: boolean;
  invalidAtSequence: number | null;
}

export interface RunTimelineReadResponse {
  contractVersion: string;
  loopRunId: string;
  timeline: import("./trace-timeline.js").TraceLoopTimeline;
}
