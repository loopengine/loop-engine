// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type {
  AggregateId,
  LoopId,
  LoopInstance,
  TransitionRecord
} from "@loop-engine/core";
import type { LoopStore } from "@loop-engine/runtime";
import { runMigrations } from "./migrations/runner";

/**
 * Narrow duck-typed view of a `pg.PoolClient`. The migration runner and
 * (forthcoming in SR-016.3) transaction helper acquire a client from the
 * pool, issue a series of queries against it, and then `release()` it.
 *
 * The real `pg.PoolClient` satisfies this shape structurally; declaring a
 * duck type rather than importing from `pg` keeps the adapter decoupled
 * from the `pg` runtime for consumers who use alternative pool
 * implementations (e.g., a test double that wraps `pg.Client`).
 */
export type PgClientLike = {
  query(sql: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  release(err?: Error | boolean): void;
};

/**
 * Narrow duck-typed view of a `pg.Pool`. Widened in SR-016.2 from the
 * original `{ query }`-only shape to include `connect()`, which the
 * migration runner requires for per-migration transactional scope and
 * advisory-lock serialization. The real `pg.Pool` satisfies this shape
 * structurally — no consumer action required.
 */
export type PgPoolLike = {
  query(sql: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  connect(): Promise<PgClientLike>;
};

export type {
  Migration,
  MigrationRunResult,
  RunMigrationsOptions
} from "./migrations/runner";

export { loadMigrations, runMigrations } from "./migrations/runner";

/**
 * Apply the adapter's baseline schema (`loop_instances` +
 * `loop_transitions` + the `schema_migrations` tracking table).
 *
 * Pre-SR-016.2, this function issued two `CREATE TABLE IF NOT EXISTS`
 * statements directly. From SR-016.2 on, it delegates to `runMigrations`
 * so the same behavior is available whether callers use the high-level
 * `createSchema` convenience or the lower-level runner API — and so the
 * `schema_migrations` tracking table is provisioned consistently across
 * both entry points.
 *
 * Retained as a backward-compatible alias; new consumers should prefer
 * `runMigrations(pool)` directly, which returns structured information
 * about which migrations were applied vs. skipped.
 */
export async function createSchema(pool: PgPoolLike): Promise<void> {
  await runMigrations(pool);
}

export function postgresStore(pool: PgPoolLike): LoopStore {
  function asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object") return value as Record<string, unknown>;
    return {};
  }

  function asString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
  }

  function asLoopInstance(row: unknown): LoopInstance {
    const item = asRecord(row);
    const metadata = item.metadata;
    return {
      loopId: asString(item.loop_id) as LoopId,
      aggregateId: asString(item.aggregate_id) as AggregateId,
      currentState: asString(item.current_state) as LoopInstance["currentState"],
      status: asString(item.status) as LoopInstance["status"],
      startedAt: new Date(asString(item.started_at)).toISOString(),
      updatedAt: new Date(asString(item.updated_at)).toISOString(),
      ...(item.completed_at ? { completedAt: new Date(asString(item.completed_at)).toISOString() } : {}),
      ...(item.correlation_id ? { correlationId: asString(item.correlation_id) } : {}),
      ...(metadata && typeof metadata === "object" ? { metadata: metadata as Record<string, unknown> } : {})
    };
  }

  function asTransitionRecord(row: unknown): TransitionRecord {
    const item = asRecord(row);
    const actor = asRecord(item.actor) as TransitionRecord["actor"];
    return {
      loopId: asString(item.loop_id) as TransitionRecord["loopId"],
      aggregateId: asString(item.aggregate_id) as TransitionRecord["aggregateId"],
      transitionId: asString(item.transition_id) as TransitionRecord["transitionId"],
      signal: asString(item.signal) as TransitionRecord["signal"],
      fromState: asString(item.from_state) as TransitionRecord["fromState"],
      toState: asString(item.to_state) as TransitionRecord["toState"],
      actor,
      occurredAt: new Date(asString(item.occurred_at)).toISOString(),
      ...(item.evidence && typeof item.evidence === "object"
        ? { evidence: item.evidence as Record<string, unknown> }
        : {})
    };
  }

  return {
    async getInstance(aggregateId: AggregateId): Promise<LoopInstance | null> {
      const result = await pool.query(
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

    async saveInstance(instance: LoopInstance): Promise<void> {
      await pool.query(
        `
          INSERT INTO loop_instances (
            aggregate_id, loop_id, current_state, status, started_at, updated_at, completed_at, correlation_id, metadata
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (aggregate_id) DO UPDATE SET
            loop_id = EXCLUDED.loop_id,
            current_state = EXCLUDED.current_state,
            status = EXCLUDED.status,
            started_at = EXCLUDED.started_at,
            updated_at = EXCLUDED.updated_at,
            completed_at = EXCLUDED.completed_at,
            correlation_id = EXCLUDED.correlation_id,
            metadata = EXCLUDED.metadata
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

    async getTransitionHistory(aggregateId: AggregateId): Promise<TransitionRecord[]> {
      const result = await pool.query(
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

    async saveTransitionRecord(record: TransitionRecord): Promise<void> {
      await pool.query(
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

    async listOpenInstances(loopId: LoopId): Promise<LoopInstance[]> {
      const result = await pool.query(
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
