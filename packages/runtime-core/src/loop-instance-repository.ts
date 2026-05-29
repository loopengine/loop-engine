// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import type { Prisma, PrismaClient } from "@loop-engine/runtime-db";

/**
 * Minimal shape consumed by the OSS write surface (RT-20c). Mirrors the
 * `LoopInstance` row in `@loop-engine/runtime-db` but exposed here as a plain
 * type so callers don't import Prisma directly.
 */
export type PersistedLoopInstance = {
  id: string;
  aggregateId: string;
  loopId: string;
  tenantId: string;
  idempotencyKey: string | null;
  currentState: string;
  status: string;
  context: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Persisted loop event row written alongside every `start`/`transition`/`cancel`
 * for back-compat with the deprecated `/api/v1/loops/{key}/events` endpoint.
 * The canonical RT-05 evidence still flows through `LoopTraceRecord`.
 */
export type PersistedLoopEvent = {
  id: string;
  aggregateId: string;
  tenantId: string;
  type: string;
  fromState: string;
  toState: string;
  actorId: string;
  actorType: string;
  evidence: Prisma.JsonValue | null;
  occurredAt: Date;
};

export type CreateLoopInstanceInput = {
  aggregateId: string;
  loopId: string;
  tenantId: string;
  idempotencyKey: string | null;
  currentState: string;
  status: string;
  context: Prisma.InputJsonValue;
};

export type UpdateLoopInstanceInput = {
  tenantId: string;
  id: string;
  currentState: string;
  status: string;
};

export type AppendLoopEventInput = {
  aggregateId: string;
  tenantId: string;
  type: string;
  fromState: string;
  toState: string;
  actorId: string;
  actorType: string;
  evidence?: Prisma.InputJsonValue | null;
};

/**
 * Sentinel error raised by `createInstance` when the
 * `(tenantId, idempotencyKey)` unique constraint collides with an existing
 * row. RT-20c F-1: callers MUST translate this to an HTTP 200 (echo of the
 * existing instance) — never a raw 500.
 */
export class LoopInstanceIdempotencyConflictError extends Error {
  constructor(public readonly tenantId: string, public readonly idempotencyKey: string) {
    super(
      `Loop instance with idempotencyKey "${idempotencyKey}" already exists for tenant "${tenantId}"`,
    );
    this.name = "LoopInstanceIdempotencyConflictError";
  }
}

/**
 * Sentinel error raised for any other constraint collision on `LoopInstance`
 * (e.g. `aggregateId @unique`). RT-20c F-1: callers MUST translate this to a
 * 409 Conflict, never a 500.
 */
export class LoopInstanceUniqueConflictError extends Error {
  constructor(public readonly target: string[]) {
    super(`Loop instance unique constraint violation: ${target.join(", ")}`);
    this.name = "LoopInstanceUniqueConflictError";
  }
}

export interface LoopInstanceRepository {
  findByAggregateId(tenantId: string, aggregateId: string): Promise<PersistedLoopInstance | null>;
  findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<PersistedLoopInstance | null>;
  createInstance(input: CreateLoopInstanceInput): Promise<PersistedLoopInstance>;
  updateInstanceState(input: UpdateLoopInstanceInput): Promise<PersistedLoopInstance>;
  appendEvent(input: AppendLoopEventInput): Promise<PersistedLoopEvent>;
}

/** Prisma-backed implementation against `@loop-engine/runtime-db`. */
export class PrismaLoopInstanceRepository implements LoopInstanceRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByAggregateId(
    tenantId: string,
    aggregateId: string,
  ): Promise<PersistedLoopInstance | null> {
    const row = await this.db.loopInstance.findUnique({ where: { aggregateId } });
    if (!row || row.tenantId !== tenantId) return null;
    return row;
  }

  async findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<PersistedLoopInstance | null> {
    const row = await this.db.loopInstance.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    });
    return row ?? null;
  }

  async createInstance(input: CreateLoopInstanceInput): Promise<PersistedLoopInstance> {
    try {
      return await this.db.loopInstance.create({ data: input });
    } catch (err) {
      // Prisma surfaces unique-constraint violations as `P2002` with a `target`
      // array naming the constraint. Map them to typed sentinels so the route
      // layer can map them deterministically (RT-20c F-1).
      const target = extractPrismaUniqueTarget(err);
      if (target) {
        if (target.includes("idempotencyKey") && input.idempotencyKey !== null) {
          throw new LoopInstanceIdempotencyConflictError(
            input.tenantId,
            input.idempotencyKey,
          );
        }
        throw new LoopInstanceUniqueConflictError(target);
      }
      throw err;
    }
  }

  async updateInstanceState(input: UpdateLoopInstanceInput): Promise<PersistedLoopInstance> {
    return this.db.loopInstance.update({
      where: { id: input.id },
      data: { currentState: input.currentState, status: input.status },
    });
  }

  async appendEvent(input: AppendLoopEventInput): Promise<PersistedLoopEvent> {
    return this.db.loopEvent.create({
      data: {
        aggregateId: input.aggregateId,
        tenantId: input.tenantId,
        type: input.type,
        fromState: input.fromState,
        toState: input.toState,
        actorId: input.actorId,
        actorType: input.actorType,
        evidence: (input.evidence ?? null) as Prisma.InputJsonValue,
      },
    });
  }
}

/**
 * Best-effort extraction of the Prisma `P2002` `target` array from an unknown
 * error. Works against both `Prisma.PrismaClientKnownRequestError` instances
 * (when the prisma client is imported) and plain `{ code, meta }` lookalikes
 * (which is what propagates through the `runtime-db` re-export at runtime).
 */
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
