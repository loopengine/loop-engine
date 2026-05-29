// SPDX-License-Identifier: Apache-2.0
// Copyright © Loop Engine Contributors

import type { TraceStore } from "./trace-store.js";
import type {
  ComparedStep,
  ListRunsOpts,
  RunComparison,
  RunSummary,
  TraceRecord,
} from "./trace-types.js";

/**
 * MemoryTraceStore — zero-configuration TraceStore for local dev and testing.
 *
 * Records survive for the process lifetime, not across restarts.
 * Appropriate for: unit tests, local development, OSS demos.
 * Not appropriate for: production — use PostgresTraceStore.
 */
export class MemoryTraceStore implements TraceStore {
  private records = new Map<string, TraceRecord[]>();
  private summaries = new Map<string, RunSummary>();

  async write(record: TraceRecord): Promise<void> {
    const existing = this.records.get(record.loopRunId) ?? [];
    this.records.set(record.loopRunId, [...existing, record].sort((a, b) => a.sequence - b.sequence));

    const current = this.summaries.get(record.loopRunId);
    const isTerminal = record.type === "loop.terminal";

    this.summaries.set(record.loopRunId, {
      loopRunId: record.loopRunId,
      loopId: record.loopId,
      startedAt: current?.startedAt ?? record.timestamp,
      completedAt: isTerminal ? record.timestamp : (current?.completedAt ?? null),
      terminalState: isTerminal ? (record.toState ?? null) : (current?.terminalState ?? null),
      stepCount: (current?.stepCount ?? 0) + 1,
      blockedCount: (current?.blockedCount ?? 0) + (record.blocked ? 1 : 0),
      governed: current?.governed === true || record.governed,
      tenantId: record.tenantId,
    });
  }

  async getRunTrace(loopRunId: string): Promise<TraceRecord[]> {
    return this.records.get(loopRunId) ?? [];
  }

  async listRuns(loopId: string, opts: ListRunsOpts = {}): Promise<RunSummary[]> {
    const all = Array.from(this.summaries.values())
      .filter((s) => s.loopId === loopId)
      .filter((s) => opts.governed === undefined || s.governed === opts.governed)
      .filter((s) => !opts.after || s.startedAt > opts.after)
      .filter((s) => !opts.before || s.startedAt < opts.before)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    return opts.limit ? all.slice(0, opts.limit) : all;
  }

  async compareRuns(loopRunIdA: string, loopRunIdB: string): Promise<RunComparison> {
    const [tracesA, tracesB, summaryA, summaryB] = await Promise.all([
      this.getRunTrace(loopRunIdA),
      this.getRunTrace(loopRunIdB),
      this.summaries.get(loopRunIdA),
      this.summaries.get(loopRunIdB),
    ]);

    if (!summaryA) throw new Error(`Run not found: ${loopRunIdA}`);
    if (!summaryB) throw new Error(`Run not found: ${loopRunIdB}`);

    const maxSeq = Math.max(
      tracesA.reduce((m: number, r: TraceRecord) => Math.max(m, r.sequence), -1),
      tracesB.reduce((m: number, r: TraceRecord) => Math.max(m, r.sequence), -1),
    );

    const steps: ComparedStep[] = [];
    let divergencePoint: number | null = null;

    for (let seq = 0; seq <= maxSeq; seq++) {
      const inA = tracesA.find((r: TraceRecord) => r.sequence === seq) ?? null;
      const inB = tracesB.find((r: TraceRecord) => r.sequence === seq) ?? null;

      const equivalent =
        inA?.type === inB?.type && inA?.toState === inB?.toState && inA?.blocked === inB?.blocked;

      if (!equivalent && divergencePoint === null) {
        divergencePoint = seq;
      }

      steps.push({ sequence: seq, inA, inB, equivalent });
    }

    return { runA: summaryA, runB: summaryB, steps, divergencePoint };
  }

  /** Test helper — clear all stored records */
  clear(): void {
    this.records.clear();
    this.summaries.clear();
  }
}
