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
 * the `withTransaction` helper both acquire a client from the pool, issue
 * a series of queries against it, and then `release()` it.
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
 * migration runner and `withTransaction` helper both require. The real
 * `pg.Pool` satisfies this shape structurally — no consumer action
 * required.
 */
export type PgPoolLike = {
  query(sql: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  connect(): Promise<PgClientLike>;
};

/**
 * A `pg`-shape object capable of issuing a query. Both `pg.Pool` and
 * `pg.PoolClient` satisfy this shape; internal to the adapter, it lets
 * the five `LoopStore` method bodies be defined once and bound to either
 * a pool (non-transactional) or a client (transactional).
 */
type Querier = {
  query(sql: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
};

export type {
  Migration,
  MigrationRunResult,
  RunMigrationsOptions
} from "./migrations/runner";

export { loadMigrations, runMigrations } from "./migrations/runner";

export type { PoolOptions } from "./pool";
export { createPool, DEFAULT_POOL_OPTIONS } from "./pool";

/**
 * LoopStore-shaped view into a running transaction. Every method routes
 * its query through the transactional `pg.PoolClient` acquired by
 * `withTransaction` rather than through a fresh pool connection, so calls
 * on the same `tx` are guaranteed to be atomic with respect to each other
 * (and isolated from any non-`tx` reads on the pool until COMMIT lands).
 *
 * Structurally identical to `LoopStore` — a `tx` is type-compatible with
 * any function expecting `LoopStore`, which lets existing code that
 * operates on a store work inside a transactional scope by receiving the
 * `tx` parameter instead of the outer store.
 *
 * Intentionally does NOT expose a raw `pg.PoolClient` escape hatch, per
 * PB-EX-02 Option A's layering discipline (provider-specific concerns
 * stay in provider-specific factories; `TransactionClient`'s surface is
 * the atomic-sequencing-of-LoopStore-operations concern and no wider).
 * Consumers needing LISTEN/NOTIFY or other non-LoopStore Postgres
 * operations should manage their own `pg.Pool` alongside the adapter's.
 */
export type TransactionClient = LoopStore;

/**
 * The return type of `postgresStore`. Extends `LoopStore` with
 * `withTransaction` — a Postgres-specific atomic-sequencing helper.
 *
 * `LoopStore` itself is locked at the SR-002 shape (per
 * `API_SURFACE_DECISIONS_RESOLVED.md`); `withTransaction` does not land
 * on the `LoopStore` contract because its semantics are Postgres-specific
 * (the `MemoryStore` has no analog, and a hypothetical file-based or
 * key-value-backed store would implement it trivially or not at all).
 * Consumers that need both LoopStore-portability and postgres-transaction
 * access annotate with `PostgresStore` at construction and `LoopStore`
 * wherever they only need the narrower contract.
 */
export interface PostgresStore extends LoopStore {
  /**
   * Execute `fn` inside a Postgres transaction. The transaction is
   * `BEGIN`-ed on a pool-acquired client before `fn` runs; `COMMIT`-ed
   * if `fn` resolves; `ROLLBACK`-ed if `fn` throws or rejects.
   *
   * `fn` receives a `TransactionClient` whose LoopStore methods route
   * through the transactional client. Calls on the outer store (the one
   * `withTransaction` was called on, i.e., the surrounding
   * `postgresStore` return value) inside `fn` acquire their own
   * connection from the pool and run in an independent non-transactional
   * scope — nesting is by design via separate client acquisitions, not
   * via SAVEPOINTs. To extend atomicity across nested calls, pass the
   * inner operations the outer `tx` and use its LoopStore methods.
   *
   * Returns `fn`'s return value on successful commit; rethrows `fn`'s
   * error on rollback. If `ROLLBACK` itself fails (e.g., connection
   * lost mid-transaction), the original `fn` error is preserved — the
   * ROLLBACK failure is swallowed, and `pg` will detect the broken
   * connection on the next use of the pool and discard it.
   */
  withTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;
}

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

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * Coerce a pg-returned TIMESTAMPTZ value to an ISO-8601 string.
 *
 * `pg`'s default type parser hydrates TIMESTAMPTZ columns into
 * JavaScript `Date` instances (not strings). The pre-SR-016.3
 * deserializers funnelled these through `asString(...) → new Date(...)
 * → .toISOString()`, which silently substituted an empty-string
 * fallback (because `Date` fails the `typeof === "string"` guard),
 * yielding `Invalid Date` and a `RangeError` on `.toISOString()`.
 *
 * The bug predates SR-016; the adapter shipped with no tests exercising
 * `saveInstance → getInstance` round-trips, so the broken path never
 * surfaced until SR-016.3's withTransaction suite forced the round-trip.
 * Documented in-execution-log as a substantive finding surfaced and
 * resolved in-SR.
 *
 * Accepts both `Date` (default pg behavior) and `string` (consumer-
 * configured `pg.types.setTypeParser` override) inputs so the adapter
 * stays robust against either type-parser configuration.
 */
function asIsoString(value: unknown, fallback: string): string {
  if (value instanceof Date) {
    const time = value.getTime();
    if (!Number.isNaN(time)) {
      return value.toISOString();
    }
    return fallback;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return value; // already-normalized / non-ISO string; pass through
  }
  return fallback;
}

function asLoopInstance(row: unknown): LoopInstance {
  const item = asRecord(row);
  const metadata = item.metadata;
  const nowIso = new Date(0).toISOString(); // deterministic fallback for test clarity
  return {
    loopId: asString(item.loop_id) as LoopId,
    aggregateId: asString(item.aggregate_id) as AggregateId,
    currentState: asString(item.current_state) as LoopInstance["currentState"],
    status: asString(item.status) as LoopInstance["status"],
    startedAt: asIsoString(item.started_at, nowIso),
    updatedAt: asIsoString(item.updated_at, nowIso),
    ...(item.completed_at ? { completedAt: asIsoString(item.completed_at, nowIso) } : {}),
    ...(item.correlation_id ? { correlationId: asString(item.correlation_id) } : {}),
    ...(metadata && typeof metadata === "object" ? { metadata: metadata as Record<string, unknown> } : {})
  };
}

function asTransitionRecord(row: unknown): TransitionRecord {
  const item = asRecord(row);
  const actor = asRecord(item.actor) as TransitionRecord["actor"];
  const nowIso = new Date(0).toISOString();
  return {
    loopId: asString(item.loop_id) as TransitionRecord["loopId"],
    aggregateId: asString(item.aggregate_id) as TransitionRecord["aggregateId"],
    transitionId: asString(item.transition_id) as TransitionRecord["transitionId"],
    signal: asString(item.signal) as TransitionRecord["signal"],
    fromState: asString(item.from_state) as TransitionRecord["fromState"],
    toState: asString(item.to_state) as TransitionRecord["toState"],
    actor,
    occurredAt: asIsoString(item.occurred_at, nowIso),
    ...(item.evidence && typeof item.evidence === "object"
      ? { evidence: item.evidence as Record<string, unknown> }
      : {})
  };
}

/**
 * Build the five `LoopStore` methods against any `pg`-shaped querier.
 * Used twice: once against a `pg.Pool` (non-transactional path in
 * `postgresStore`) and once against a `pg.PoolClient` inside
 * `withTransaction`'s callback. Factoring the method bodies here keeps
 * the transactional and non-transactional paths bit-for-bit identical
 * at the query layer; the only difference is which underlying pg object
 * executes the query.
 */
function buildLoopStoreAgainst(q: Querier): LoopStore {
  return {
    async getInstance(aggregateId: AggregateId): Promise<LoopInstance | null> {
      const result = await q.query(
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
      await q.query(
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
      const result = await q.query(
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
      await q.query(
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
      const result = await q.query(
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

export function postgresStore(pool: PgPoolLike): PostgresStore {
  const nonTxMethods = buildLoopStoreAgainst(pool);

  async function withTransaction<T>(
    fn: (tx: TransactionClient) => Promise<T>
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      try {
        const tx = buildLoopStoreAgainst(client);
        const result = await fn(tx);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Preserve the original fn error; ROLLBACK failure commonly
          // indicates a broken connection, which `pg.Pool` will detect
          // and evict on the next use of the released client.
        }
        throw err;
      }
    } finally {
      client.release();
    }
  }

  return {
    ...nonTxMethods,
    withTransaction
  };
}
