// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import type { RunSummary, TraceRecord } from "@loop-engine/observability";
import {
  RUNTIME_API_CONTRACT_VERSION,
  buildTimelineFromTrace,
  computeMetricsFromTrace,
  type RunAuditEventDto,
  type RunDetailReadResponse,
  type RunEvidenceItemDto,
  type RunEvidenceReadResponse,
  type RunHistoryReadResponse,
  type RunReadSummaryDto,
  type RunReplaySummaryReadResponse,
  type RunTimelineReadResponse,
} from "@loop-engine/observability";

import type { PersistedRunSummaryRow } from "./trace-repository.js";

function evidenceAsRecord(ev: unknown): Record<string, unknown> {
  if (ev !== null && typeof ev === "object" && !Array.isArray(ev)) {
    return ev as Record<string, unknown>;
  }
  return {};
}

export function summaryRowToRunSummary(row: PersistedRunSummaryRow): RunSummary {
  return {
    loopRunId: row.loopRunId,
    loopId: row.loopId,
    tenantId: row.tenantId,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    terminalState: row.terminalState,
    stepCount: row.stepCount,
    blockedCount: row.blockedCount,
    governed: row.governed,
  };
}

export function toRunReadSummaryDto(summary: RunSummary): RunReadSummaryDto {
  return {
    loopRunId: summary.loopRunId,
    loopId: summary.loopId,
    startedAt: summary.startedAt.toISOString(),
    completedAt: summary.completedAt?.toISOString() ?? null,
    terminalState: summary.terminalState,
    stepCount: summary.stepCount,
    blockedCount: summary.blockedCount,
    governed: summary.governed,
  };
}

export function traceToAuditEvents(trace: TraceRecord[]): RunAuditEventDto[] {
  return [...trace]
    .sort((a, b) => a.sequence - b.sequence)
    .map((record) => ({
      eventId: record.id,
      sequence: record.sequence,
      type: record.type,
      fromState: record.fromState,
      toState: record.toState,
      transitionId: record.transitionId,
      actor: { id: String(record.actor.id), type: record.actor.type },
      evidence: evidenceAsRecord(record.evidence),
      occurredAt: record.timestamp.toISOString(),
      blocked: record.blocked,
      blockReason: record.blockReason,
    }));
}

export function traceToEvidenceItems(trace: TraceRecord[]): RunEvidenceItemDto[] {
  return [...trace]
    .sort((a, b) => a.sequence - b.sequence)
    .map((record) => ({
      sequence: record.sequence,
      eventId: record.id,
      transitionId: record.transitionId,
      type: record.type,
      occurredAt: record.timestamp.toISOString(),
      evidence: evidenceAsRecord(record.evidence),
    }));
}

export function validateTraceSequence(trace: TraceRecord[]): {
  sequenceValid: boolean;
  invalidAtSequence: number | null;
} {
  const sorted = [...trace].sort((a, b) => a.sequence - b.sequence);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i]?.sequence !== i) {
      return { sequenceValid: false, invalidAtSequence: sorted[i]?.sequence ?? i };
    }
  }
  return { sequenceValid: true, invalidAtSequence: null };
}

export function buildRunDetailResponse(
  summary: RunSummary,
  trace: TraceRecord[],
): RunDetailReadResponse {
  const base = `/api/v1/runs/${summary.loopRunId}`;
  return {
    contractVersion: RUNTIME_API_CONTRACT_VERSION,
    run: toRunReadSummaryDto(summary),
    traceStepCount: trace.length,
    readSurfaces: {
      history: `${base}/history`,
      evidence: `${base}/evidence`,
      timeline: `${base}/timeline`,
      replaySummary: `${base}/replay-summary`,
      legacyTrace: `/api/v1/loops/runs/${summary.loopRunId}`,
    },
  };
}

export function buildRunHistoryResponse(
  summary: RunSummary,
  trace: TraceRecord[],
): RunHistoryReadResponse {
  return {
    contractVersion: RUNTIME_API_CONTRACT_VERSION,
    loopRunId: summary.loopRunId,
    loopId: summary.loopId,
    events: traceToAuditEvents(trace),
  };
}

export function buildRunEvidenceResponse(
  summary: RunSummary,
  trace: TraceRecord[],
): RunEvidenceReadResponse {
  return {
    contractVersion: RUNTIME_API_CONTRACT_VERSION,
    loopRunId: summary.loopRunId,
    loopId: summary.loopId,
    items: traceToEvidenceItems(trace),
  };
}

export function buildRunTimelineResponse(
  summary: RunSummary,
  trace: TraceRecord[],
): RunTimelineReadResponse {
  return {
    contractVersion: RUNTIME_API_CONTRACT_VERSION,
    loopRunId: summary.loopRunId,
    timeline: buildTimelineFromTrace(trace),
  };
}

export function buildRunReplaySummaryResponse(
  summary: RunSummary,
  trace: TraceRecord[],
): RunReplaySummaryReadResponse {
  const timeline = buildTimelineFromTrace(trace);
  const metrics = computeMetricsFromTrace(timeline);
  const { sequenceValid, invalidAtSequence } = validateTraceSequence(trace);
  return {
    contractVersion: RUNTIME_API_CONTRACT_VERSION,
    loopRunId: summary.loopRunId,
    loopId: summary.loopId,
    metrics,
    transitionCount: metrics.transitionCount,
    guardBlockCount: metrics.guardBlockCount,
    humanApprovalCount: metrics.humanApprovalCount,
    terminalState: metrics.terminalState,
    sequenceValid,
    invalidAtSequence,
  };
}
