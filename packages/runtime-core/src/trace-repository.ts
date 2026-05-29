// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import type { Prisma, PrismaClient } from "@loop-engine/runtime-db";

export type PersistedTraceRow = {
  id: string;
  loopRunId: string;
  loopId: string;
  tenantId: string;
  sequence: number;
  timestamp: Date;
  type: string;
  fromState: string | null;
  toState: string | null;
  transitionId: string | null;
  actorType: string;
  actorId: string;
  inputHash: string;
  input: unknown;
  output: unknown;
  guards: unknown;
  evidence: unknown;
  durationMs: number;
  blocked: boolean;
  blockReason: string | null;
  governed: boolean;
};

export type PersistedRunSummaryRow = {
  tenantId: string;
  loopRunId: string;
  loopId: string;
  startedAt: Date;
  completedAt: Date | null;
  terminalState: string | null;
  stepCount: number;
  blockedCount: number;
  governed: boolean;
  updatedAt: Date;
};

export type PersistTraceInput = {
  id: string;
  loopRunId: string;
  loopId: string;
  tenantId: string;
  sequence: number;
  timestamp: Date;
  type: string;
  fromState: string | null;
  toState: string | null;
  transitionId: string | null;
  actorType: string;
  actorId: string;
  inputHash: string;
  input: Prisma.InputJsonValue;
  output: Prisma.InputJsonValue;
  guards: Prisma.InputJsonValue;
  evidence: Prisma.InputJsonValue;
  durationMs: number;
  blocked: boolean;
  blockReason: string | null;
  governed: boolean;
};

/**
 * Narrow read surface used by `buildRun*Response` helpers and route factories.
 * Lets tests swap in an in-memory implementation without standing up Postgres.
 */
export interface TraceReadRepository {
  getRunSummary(loopRunId: string, tenantId: string): Promise<PersistedRunSummaryRow | null>;
  getRunTrace(loopRunId: string, tenantId: string): Promise<PersistedTraceRow[]>;
}

/**
 * Loop-trace write surface (mirrors the legacy `persistTraceWithSummary` from
 * `@betterdata/database-loops`). Used by the `OssPostgresTraceStore` write path.
 */
export interface TraceWriteRepository {
  /**
   * Allocate the next monotonic sequence for `(tenantId, loopRunId)`.
   * Uses `max(sequence)+1` inside a transaction so multi-replica writers
   * converge on unique sequence numbers (RT-20d).
   */
  allocateNextSequence(tenantId: string, loopRunId: string): Promise<number>;
  persistTraceWithSummary(input: PersistTraceInput): Promise<void>;
}

/**
 * Composite repository handed to the trace store. The Prisma-backed
 * implementation below satisfies both halves; tests can satisfy either
 * independently.
 */
export interface TraceRepository extends TraceReadRepository, TraceWriteRepository {}

/**
 * Production repository backed by `@loop-engine/runtime-db`. The hosted-loops
 * build never imports this — it keeps its own `@betterdata/database-loops`
 * repository to preserve cloud-only relations.
 */
export class PrismaTraceRepository implements TraceRepository {
  constructor(private readonly db: PrismaClient) {}

  async getRunSummary(
    loopRunId: string,
    tenantId: string,
  ): Promise<PersistedRunSummaryRow | null> {
    return this.db.loopRunSummary.findUnique({
      where: { tenantId_loopRunId: { tenantId, loopRunId } },
    });
  }

  async getRunTrace(loopRunId: string, tenantId: string): Promise<PersistedTraceRow[]> {
    const rows = await this.db.loopTraceRecord.findMany({
      where: { tenantId, loopRunId },
      orderBy: { sequence: "asc" },
    });
    return rows.map((row) => ({
      ...row,
      input: row.input,
      output: row.output,
      guards: row.guards,
      evidence: row.evidence,
    }));
  }

  async allocateNextSequence(tenantId: string, loopRunId: string): Promise<number> {
    return this.db.$transaction(async (tx) => {
      const agg = await tx.loopTraceRecord.aggregate({
        where: { tenantId, loopRunId },
        _max: { sequence: true },
      });
      return (agg._max.sequence ?? -1) + 1;
    });
  }

  async persistTraceWithSummary(input: PersistTraceInput): Promise<void> {
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await this.persistTraceWithSummaryOnce(input);
        return;
      } catch (err) {
        const target = extractPrismaUniqueTarget(err);
        const isSequenceRace =
          target !== null &&
          (target.includes("sequence") ||
            target.some((t) => t.includes("tenantId_loopRunId_sequence")));
        if (!isSequenceRace || attempt === maxAttempts - 1) {
          throw err;
        }
        input = {
          ...input,
          sequence: await this.allocateNextSequence(input.tenantId, input.loopRunId),
        };
      }
    }
  }

  private async persistTraceWithSummaryOnce(input: PersistTraceInput): Promise<void> {
    const { tenantId, loopRunId, loopId } = input;
    await this.db.$transaction(async (tx) => {
      await tx.loopTraceRecord.create({ data: input });

      const existing = await tx.loopRunSummary.findUnique({
        where: { tenantId_loopRunId: { tenantId, loopRunId } },
      });

      const isTerminal = input.type === "loop.terminal";

      if (!existing) {
        await tx.loopRunSummary.create({
          data: {
            tenantId,
            loopRunId,
            loopId,
            startedAt: input.timestamp,
            completedAt: isTerminal ? input.timestamp : null,
            terminalState: isTerminal ? input.toState : null,
            stepCount: 1,
            blockedCount: input.blocked ? 1 : 0,
            governed: input.governed,
          },
        });
        return;
      }

      await tx.loopRunSummary.update({
        where: { tenantId_loopRunId: { tenantId, loopRunId } },
        data: {
          stepCount: { increment: 1 },
          blockedCount: { increment: input.blocked ? 1 : 0 },
          governed: existing.governed || input.governed,
          ...(isTerminal
            ? { completedAt: input.timestamp, terminalState: input.toState }
            : {}),
        },
      });
    });
  }
}

function extractPrismaUniqueTarget(err: unknown): string[] | null {
  if (!err || typeof err !== "object") return null;
  const code = (err as { code?: unknown }).code;
  if (code !== "P2002") return null;
  const meta = (err as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") return null;
  const target = (meta as { target?: unknown }).target;
  if (Array.isArray(target)) return target.filter((t): t is string => typeof t === "string");
  if (typeof target === "string") return [target];
  return null;
}
