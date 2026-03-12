// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { AggregateId, LoopId } from "@loop-engine/core";
import type {
  LoopStorageAdapter,
  RuntimeLoopInstance,
  RuntimeTransitionRecord
} from "@loop-engine/runtime";

export type PgPoolLike = {
  query(sql: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
};

export async function createSchema(pool: PgPoolLike): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loop_instances (
      aggregate_id TEXT PRIMARY KEY,
      loop_id TEXT NOT NULL,
      current_state TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ NULL,
      correlation_id TEXT NULL,
      metadata JSONB NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loop_transitions (
      id BIGSERIAL PRIMARY KEY,
      loop_id TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      transition_id TEXT NOT NULL,
      signal TEXT NOT NULL,
      from_state TEXT NOT NULL,
      to_state TEXT NOT NULL,
      actor JSONB NOT NULL,
      evidence JSONB NULL,
      occurred_at TIMESTAMPTZ NOT NULL
    );
  `);
}

export function postgresStorageAdapter(_pool: PgPoolLike): LoopStorageAdapter {
  function asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object") return value as Record<string, unknown>;
    return {};
  }

  function asString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
  }

  function asLoopInstance(row: unknown): RuntimeLoopInstance {
    const item = asRecord(row);
    const metadata = item.metadata;
    return {
      loopId: asString(item.loop_id) as LoopId,
      aggregateId: asString(item.aggregate_id) as AggregateId,
      currentState: asString(item.current_state) as RuntimeLoopInstance["currentState"],
      status: asString(item.status) as RuntimeLoopInstance["status"],
      startedAt: new Date(asString(item.started_at)).toISOString(),
      updatedAt: new Date(asString(item.updated_at)).toISOString(),
      ...(item.completed_at ? { completedAt: new Date(asString(item.completed_at)).toISOString() } : {}),
      ...(item.correlation_id ? { correlationId: asString(item.correlation_id) } : {}),
      ...(metadata && typeof metadata === "object" ? { metadata: metadata as Record<string, unknown> } : {})
    };
  }

  function asTransitionRecord(row: unknown): RuntimeTransitionRecord {
    const item = asRecord(row);
    const actor = asRecord(item.actor) as RuntimeTransitionRecord["actor"];
    return {
      loopId: asString(item.loop_id) as RuntimeTransitionRecord["loopId"],
      aggregateId: asString(item.aggregate_id) as RuntimeTransitionRecord["aggregateId"],
      transitionId: asString(item.transition_id) as RuntimeTransitionRecord["transitionId"],
      signal: asString(item.signal) as RuntimeTransitionRecord["signal"],
      fromState: asString(item.from_state) as RuntimeTransitionRecord["fromState"],
      toState: asString(item.to_state) as RuntimeTransitionRecord["toState"],
      actor,
      occurredAt: new Date(asString(item.occurred_at)).toISOString(),
      ...(item.evidence && typeof item.evidence === "object"
        ? { evidence: item.evidence as Record<string, unknown> }
        : {})
    };
  }

  return {
    async getLoop(aggregateId: AggregateId): Promise<RuntimeLoopInstance | null> {
      const result = await _pool.query(
        `
          SELECT aggregate_id, loop_id, current_state, status, started_at, updated_at, completed_at, correlation_id, metadata
          FROM loop_instances
          WHERE aggregate_id = $1
          LIMIT 1
        `,
        [aggregateId]
      );
      const row = result.rows[0];
      if (!row) return null;
      return asLoopInstance(row);
    },
    async createLoop(instance: RuntimeLoopInstance): Promise<void> {
      await _pool.query(
        `
          INSERT INTO loop_instances (
            aggregate_id, loop_id, current_state, status, started_at, updated_at, completed_at, correlation_id, metadata
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          instance.aggregateId,
          instance.loopId,
          instance.currentState,
          instance.status,
          instance.startedAt,
          instance.updatedAt,
          instance.completedAt ?? null,
          instance.correlationId ?? null,
          instance.metadata ?? null
        ]
      );
    },

    async updateLoop(instance: RuntimeLoopInstance): Promise<void> {
      await _pool.query(
        `
          UPDATE loop_instances
          SET
            loop_id = $2,
            current_state = $3,
            status = $4,
            started_at = $5,
            updated_at = $6,
            completed_at = $7,
            correlation_id = $8,
            metadata = $9
          WHERE aggregate_id = $1
        `,
        [
          instance.aggregateId,
          instance.loopId,
          instance.currentState,
          instance.status,
          instance.startedAt,
          instance.updatedAt,
          instance.completedAt ?? null,
          instance.correlationId ?? null,
          instance.metadata ?? null
        ]
      );
    },

    async getTransitions(aggregateId: AggregateId): Promise<RuntimeTransitionRecord[]> {
      const result = await _pool.query(
        `
          SELECT loop_id, aggregate_id, transition_id, signal, from_state, to_state, actor, evidence, occurred_at
          FROM loop_transitions
          WHERE aggregate_id = $1
          ORDER BY occurred_at ASC, id ASC
        `,
        [aggregateId]
      );
      return result.rows.map(asTransitionRecord);
    },

    async appendTransition(record: RuntimeTransitionRecord): Promise<void> {
      await _pool.query(
        `
          INSERT INTO loop_transitions (
            loop_id, aggregate_id, transition_id, signal, from_state, to_state, actor, evidence, occurred_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          record.loopId,
          record.aggregateId,
          record.transitionId,
          record.signal,
          record.fromState,
          record.toState,
          record.actor,
          record.evidence ?? null,
          record.occurredAt
        ]
      );
    },

    async listOpenLoops(loopId: LoopId): Promise<RuntimeLoopInstance[]> {
      const result = await _pool.query(
        `
          SELECT aggregate_id, loop_id, current_state, status, started_at, updated_at, completed_at, correlation_id, metadata
          FROM loop_instances
          WHERE loop_id = $1
            AND status = 'active'
          ORDER BY started_at ASC, aggregate_id ASC
        `,
        [loopId]
      );
      return result.rows.map(asLoopInstance);
    }
  };
}

export function postgresStore(pool: PgPoolLike): LoopStorageAdapter {
  return postgresStorageAdapter(pool);
}
