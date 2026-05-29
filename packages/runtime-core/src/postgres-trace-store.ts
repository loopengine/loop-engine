// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { actorId as toActorId } from "@loop-engine/core";
import type { Prisma } from "@loop-engine/runtime-db";
import type {
  ComparedStep,
  ListRunsOpts,
  RunComparison,
  RunSummary,
  TraceRecord,
  TraceStore,
} from "@loop-engine/observability";

import type {
  PersistedRunSummaryRow,
  PersistedTraceRow,
  TraceRepository,
} from "./trace-repository.js";

/**
 * Convert a persisted trace row back into the canonical `TraceRecord` shape
 * used by `@loop-engine/observability`. Exported so that the read middleware
 * in `@loop-engine/runtime-routes` can hydrate trace rows against the
 * authenticated identity tenant without going through a per-tenant store
 * (see RT-20-review finding F-2).
 */
export function rowToTraceRecord(row: PersistedTraceRow): TraceRecord {
  return {
    id: row.id,
    loopRunId: row.loopRunId,
    loopId: row.loopId,
    sequence: row.sequence,
    timestamp: row.timestamp,
    type: row.type as TraceRecord["type"],
    fromState: row.fromState,
    toState: row.toState,
    transitionId: row.transitionId,
    actor: { type: row.actorType as TraceRecord["actor"]["type"], id: toActorId(row.actorId) },
    inputHash: row.inputHash,
    input: row.input,
    output: row.output,
    guards: row.guards as TraceRecord["guards"],
    evidence: row.evidence as TraceRecord["evidence"],
    durationMs: row.durationMs,
    blocked: row.blocked,
    blockReason: row.blockReason,
    governed: row.governed,
    tenantId: row.tenantId,
  };
}

/**
 * Optional extension for trace stores that allocate sequence numbers from
 * durable storage (Postgres) instead of an in-process counter.
 */
export interface TraceSequenceAllocator {
  allocateNextSequence(loopRunId: string): Promise<number>;
}

export function isTraceSequenceAllocator(
  store: TraceStore,
): store is TraceStore & TraceSequenceAllocator {
  const candidate = store as TraceStore & Partial<TraceSequenceAllocator>;
  return typeof candidate.allocateNextSequence === "function";
}

/**
 * OSS Postgres trace store backed by `@loop-engine/runtime-db`. Mirrors the
 * shape of `PostgresTraceStore` from `@betterdata/database-loops` but with the
 * cloud-only relations stripped (no Slack/Google FK joins, no LoopBillingEvent
 * writes, no tenant-pool sharding).
 *
 * Reads + writes are scoped to `tenantId` per the RT-01 frozen contract.
 */
export class OssPostgresTraceStore implements TraceStore, TraceSequenceAllocator {
  constructor(
    private readonly tenantId: string,
    private readonly repo: TraceRepository,
  ) {}

  async allocateNextSequence(loopRunId: string): Promise<number> {
    return this.repo.allocateNextSequence(this.tenantId, loopRunId);
  }

  async write(record: TraceRecord): Promise<void> {
    if (record.tenantId !== this.tenantId) {
      throw new Error(
        `TraceRecord tenantId mismatch: expected ${this.tenantId}, got ${record.tenantId}`,
      );
    }
    await this.repo.persistTraceWithSummary({
      id: record.id,
      loopRunId: record.loopRunId,
      loopId: record.loopId,
      tenantId: record.tenantId,
      sequence: record.sequence,
      timestamp: record.timestamp,
      type: record.type,
      fromState: record.fromState,
      toState: record.toState,
      transitionId: record.transitionId,
      actorType: record.actor.type,
      actorId: record.actor.id,
      inputHash: record.inputHash,
      input: jsonClone(record.input),
      output: jsonClone(record.output),
      guards: jsonClone(record.guards),
      evidence: jsonClone(record.evidence),
      durationMs: record.durationMs,
      blocked: record.blocked,
      blockReason: record.blockReason,
      governed: record.governed,
    });
  }

  async getRunTrace(loopRunId: string): Promise<TraceRecord[]> {
    const rows = await this.repo.getRunTrace(loopRunId, this.tenantId);
    return rows.map((row) => rowToTraceRecord(row));
  }

  async listRuns(_loopId: string, _opts: ListRunsOpts = {}): Promise<RunSummary[]> {
    // listRuns is not part of the verify-quickstart surface; the OSS runtime
    // can implement it later via a dedicated repository method. Throw a clear
    // error rather than silently returning [] so misuse surfaces loudly.
    throw new Error(
      "OssPostgresTraceStore.listRuns is not implemented — wire a list repository before calling.",
    );
  }

  async compareRuns(loopRunIdA: string, loopRunIdB: string): Promise<RunComparison> {
    const [tracesA, tracesB, summaryA, summaryB] = await Promise.all([
      this.getRunTrace(loopRunIdA),
      this.getRunTrace(loopRunIdB),
      this.repo.getRunSummary(loopRunIdA, this.tenantId),
      this.repo.getRunSummary(loopRunIdB, this.tenantId),
    ]);

    if (!summaryA) throw new Error(`Run not found: ${loopRunIdA}`);
    if (!summaryB) throw new Error(`Run not found: ${loopRunIdB}`);

    const runA = toRunSummary(summaryA);
    const runB = toRunSummary(summaryB);
    const maxSeq = Math.max(
      tracesA.reduce((m, r) => Math.max(m, r.sequence), -1),
      tracesB.reduce((m, r) => Math.max(m, r.sequence), -1),
    );
    const steps: ComparedStep[] = [];
    let divergencePoint: number | null = null;
    for (let seq = 0; seq <= maxSeq; seq++) {
      const inA = tracesA.find((r) => r.sequence === seq) ?? null;
      const inB = tracesB.find((r) => r.sequence === seq) ?? null;
      const equivalent =
        inA?.type === inB?.type && inA?.toState === inB?.toState && inA?.blocked === inB?.blocked;
      if (!equivalent && divergencePoint === null) divergencePoint = seq;
      steps.push({ sequence: seq, inA, inB, equivalent });
    }
    return { runA, runB, steps, divergencePoint };
  }
}

function jsonClone(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function toRunSummary(row: PersistedRunSummaryRow): RunSummary {
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
