// SPDX-License-Identifier: Apache-2.0
// Copyright © Loop Engine Contributors

import type { TraceRecord } from "./trace-types.js";

export interface TraceStateResidency {
  state: string;
  /** ISO 8601 */
  enteredAt: string;
  exitedAt: string | null;
  durationMs: number | null;
}

export interface TraceLoopTimeline {
  loopId: string;
  instanceId: string;
  startedAt: string;
  completedAt: string | null;
  transitions: Array<{
    from: string;
    to: string;
    transitionId: string;
    actor: { id: string; type: string };
    timestamp: string;
    evidence?: Record<string, unknown>;
    guardResults?: Array<{ guardId: string; passed: boolean; reason?: string }>;
  }>;
  stateResidency: TraceStateResidency[];
}

export interface TraceLoopMetrics {
  loopId: string;
  instanceId: string;
  totalDurationMs: number | null;
  transitionCount: number;
  guardBlockCount: number;
  humanApprovalCount: number;
  terminalState: string | null;
  outcomeId: string | null;
}

function isTraceRecord(value: unknown): value is TraceRecord {
  if (value === null || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.loopRunId === "string" &&
    typeof r.sequence === "number" &&
    typeof r.type === "string" &&
    r.timestamp instanceof Date
  );
}

function toIso(d: Date): string {
  return d.toISOString();
}

function evidenceToRecord(ev: unknown): Record<string, unknown> | undefined {
  if (ev === null || ev === undefined) return undefined;
  if (typeof ev === "object" && !Array.isArray(ev)) {
    return ev as Record<string, unknown>;
  }
  return undefined;
}

function guardResultsFromTrace(
  guards: TraceRecord["guards"],
): Array<{ guardId: string; passed: boolean; reason?: string }> {
  return guards.map((g) => ({
    guardId: g.guardId,
    passed: g.passed,
    reason: g.reason || undefined,
  }));
}

/**
 * Build a {@link TraceLoopTimeline} from persisted {@link TraceRecord} rows (e.g. MemoryTraceStore).
 */
export function buildTimelineFromTrace(records: unknown[]): TraceLoopTimeline {
  const list = records.filter(isTraceRecord).sort((a, b) => a.sequence - b.sequence);

  if (list.length === 0) {
    return {
      loopId: "",
      instanceId: "",
      startedAt: new Date(0).toISOString(),
      completedAt: null,
      transitions: [],
      stateResidency: [],
    };
  }

  const loopId = list[0].loopId;
  const instanceId = list[0].loopRunId;

  const startedRec =
    list.find((r) => r.type === "loop.started") ?? list[0];
  const terminalRec = list.find((r) => r.type === "loop.terminal") ?? null;

  const startedAt = toIso(startedRec.timestamp);
  const completedAt = terminalRec ? toIso(terminalRec.timestamp) : null;

  const transitions: TraceLoopTimeline["transitions"] = [];

  for (const r of list) {
    if (r.type !== "transition.completed" && r.type !== "transition.blocked") {
      continue;
    }
    const from = r.fromState ?? "";
    const to = r.toState ?? "";
    transitions.push({
      from,
      to,
      transitionId: r.transitionId ?? "",
      actor: {
        id: String(r.actor?.id ?? "unknown"),
        type: String(r.actor?.type ?? "unknown"),
      },
      timestamp: toIso(r.timestamp),
      evidence: evidenceToRecord(r.evidence),
      guardResults: guardResultsFromTrace(r.guards),
    });
  }

  const stateResidency = computeStateResidency(list);

  return {
    loopId,
    instanceId,
    startedAt,
    completedAt,
    transitions,
    stateResidency,
  };
}

function computeStateResidency(sorted: TraceRecord[]): TraceStateResidency[] {
  const out: TraceStateResidency[] = [];
  let currentState: string | null = null;
  let enteredAt: Date | null = null;

  const close = (exitAt: Date) => {
    if (currentState !== null && enteredAt !== null) {
      out.push({
        state: currentState,
        enteredAt: toIso(enteredAt),
        exitedAt: toIso(exitAt),
        durationMs: exitAt.getTime() - enteredAt.getTime(),
      });
    }
  };

  for (const r of sorted) {
    if (r.type === "loop.started") {
      if (r.toState) {
        currentState = r.toState;
        enteredAt = r.timestamp;
      }
      continue;
    }
    if (r.type === "transition.completed" || r.type === "transition.blocked") {
      if (r.fromState && r.toState) {
        if (currentState === r.fromState && enteredAt) {
          close(r.timestamp);
        }
        currentState = r.toState;
        enteredAt = r.timestamp;
      }
      continue;
    }
    if (r.type === "loop.terminal") {
      close(r.timestamp);
      currentState = null;
      enteredAt = null;
    }
  }

  if (currentState !== null && enteredAt !== null) {
    out.push({
      state: currentState,
      enteredAt: toIso(enteredAt),
      exitedAt: null,
      durationMs: null,
    });
  }

  return out;
}

/**
 * Aggregate metrics for dashboards / compare views from a trace-built timeline.
 */
export function computeMetricsFromTrace(timeline: TraceLoopTimeline): TraceLoopMetrics {
  const started = Date.parse(timeline.startedAt);
  const completed = timeline.completedAt ? Date.parse(timeline.completedAt) : NaN;
  const totalDurationMs =
    Number.isFinite(started) && Number.isFinite(completed)
      ? completed - started
      : null;

  let guardBlockCount = 0;
  let humanApprovalCount = 0;

  for (const t of timeline.transitions) {
    const anyFailed = t.guardResults?.some((g) => !g.passed);
    if (anyFailed) guardBlockCount += 1;
    const at = t.actor.type.toLowerCase();
    if (at.includes("human") || at === "user" || at === "approver") {
      humanApprovalCount += 1;
    }
  }

  const terminalState =
    timeline.transitions.length > 0
      ? timeline.transitions[timeline.transitions.length - 1]?.to ?? null
      : null;

  return {
    loopId: timeline.loopId,
    instanceId: timeline.instanceId,
    totalDurationMs,
    transitionCount: timeline.transitions.length,
    guardBlockCount,
    humanApprovalCount,
    terminalState,
    outcomeId: null,
  };
}

export function getStateResidencyFromTrace(timeline: TraceLoopTimeline): TraceStateResidency[] {
  return timeline.stateResidency;
}

/** Replay / rebuild a timeline from raw trace rows (same as {@link buildTimelineFromTrace}). */
export function replayLoopFromTrace(records: unknown[]): TraceLoopTimeline {
  return buildTimelineFromTrace(records);
}
