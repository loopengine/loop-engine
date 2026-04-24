// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * SR-016.3 integration tests for `postgresStore(...).withTransaction(fn)`.
 *
 * Exercises the four behaviors the operator framing called out:
 *
 *   - commit              → fn resolves; changes persist.
 *   - rollback            → fn rejects with a user-thrown error;
 *                           changes don't persist; error propagates.
 *   - savepoint-in-error- → fn rejects with a database-side error
 *     path                  (constraint violation, invalid SQL);
 *                           rollback still lands cleanly and the
 *                           original pg error propagates.
 *   - nested-transaction  → outer + inner `withTransaction` calls
 *     behavior              acquire independent clients; outer rollback
 *                           does not affect inner commit (the expected
 *                           semantics given that nesting is via pool
 *                           acquisition, not SAVEPOINTs).
 *
 * Plus three reliability checks:
 *
 *   - return-value propagation: fn's return value is the withTransaction
 *     return value.
 *   - isolation during fn: outside-tx reads don't observe in-tx writes
 *     until COMMIT.
 *   - post-rollback recovery: the next withTransaction after a rollback
 *     works cleanly (no leftover transaction state in the pool).
 *
 * All tests run against Postgres 16 only; infrastructure-level
 * compatibility with 15 is covered by SR-016.1's smoke test and the
 * withTransaction logic is Postgres-version-independent.
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from "vitest";

import {
  postgresStore,
  runMigrations,
  TransactionIntegrityError,
  classifyError,
  type PostgresStore
} from "../index";
import type {
  AggregateId,
  LoopId,
  LoopInstance,
  TransitionRecord
} from "@loop-engine/core";
import { startPostgres, type PostgresTestContext } from "./helpers/postgres";

describe("@loop-engine/adapter-postgres withTransaction", () => {
  let ctx: PostgresTestContext;
  let store: PostgresStore;

  beforeAll(async () => {
    ctx = await startPostgres("postgres:16-alpine");
    await runMigrations(ctx.pool);
    store = postgresStore(ctx.pool);
  });

  afterAll(async () => {
    if (ctx) {
      await ctx.teardown();
    }
  });

  beforeEach(async () => {
    // Reset domain tables between tests; keep schema_migrations so we
    // don't pay the migration cost repeatedly.
    await ctx.pool.query(`TRUNCATE loop_instances, loop_transitions`);
  });

  it("commits fn's operations atomically", async () => {
    const instance = makeInstance("A-commit");
    const record = makeTransitionRecord("A-commit", "TX-001");

    await store.withTransaction(async (tx) => {
      await tx.saveInstance(instance);
      await tx.saveTransitionRecord(record);
    });

    // Both rows are visible outside the transaction after commit.
    expect(await store.getInstance(instance.aggregateId)).toMatchObject({
      aggregateId: instance.aggregateId,
      loopId: instance.loopId
    });
    const history = await store.getTransitionHistory(record.aggregateId);
    expect(history).toHaveLength(1);
    expect(history[0]?.transitionId).toBe("TX-001");
  });

  it("rolls back fn's operations when fn throws a user error", async () => {
    const instance = makeInstance("A-rollback");
    const sentinel = new Error("business-logic-rollback");

    await expect(
      store.withTransaction(async (tx) => {
        await tx.saveInstance(instance);
        throw sentinel;
      })
    ).rejects.toBe(sentinel);

    // Nothing persisted.
    expect(await store.getInstance(instance.aggregateId)).toBeNull();
    const history = await store.getTransitionHistory(instance.aggregateId);
    expect(history).toHaveLength(0);
  });

  it("rolls back cleanly when a database-side error originates inside fn", async () => {
    // Database-side error (division by zero) raised mid-transaction.
    // The outer ROLLBACK must still land; the tx's prior saveInstance
    // must not persist; the pg error must propagate unchanged to the
    // caller.
    //
    // `tx` is LoopStore-shaped by design (no raw-query escape hatch
    // per PB-EX-02 Option A); we route the failing query through the
    // outer pool to simulate "fn does non-LoopStore work that a
    // downstream callee raises from." This is the realistic path by
    // which pg-side errors enter a business-logic `fn`.
    const instance = makeInstance("A-pg-error");

    await expect(
      store.withTransaction(async (tx) => {
        await tx.saveInstance(instance);
        await ctx.pool.query("SELECT 1 / 0 AS boom");
      })
    ).rejects.toThrow(/division by zero/i);

    // saveInstance inside the transaction rolled back cleanly despite
    // the error originating from a non-tx pg operation.
    expect(await store.getInstance(instance.aggregateId)).toBeNull();
  });

  it("propagates fn's return value on commit", async () => {
    const instance = makeInstance("A-return");
    const result = await store.withTransaction(async (tx) => {
      await tx.saveInstance(instance);
      return { savedAggregateId: instance.aggregateId, savedAt: Date.now() };
    });

    expect(result.savedAggregateId).toBe(instance.aggregateId);
    expect(typeof result.savedAt).toBe("number");
  });

  it("isolates in-flight writes from outside-tx reads until commit", async () => {
    const instance = makeInstance("A-isolation");

    // We need to observe the "in-flight" state. Arrange a race: inside
    // fn, we await a short pause during which another pool query tries
    // to read the row. Before COMMIT, the row must not be visible from
    // outside the transaction.
    let observedMidTx: LoopInstance | null = null;

    await store.withTransaction(async (tx) => {
      await tx.saveInstance(instance);

      // Outside-tx read against a separate pool connection. This is
      // Postgres's default READ COMMITTED isolation — uncommitted data
      // is invisible to other transactions.
      observedMidTx = await store.getInstance(instance.aggregateId);
    });

    expect(observedMidTx).toBeNull();
    // After commit, the row is visible.
    expect(await store.getInstance(instance.aggregateId)).not.toBeNull();
  });

  it("allows subsequent withTransaction calls after a rollback (no lingering state)", async () => {
    const bad = makeInstance("A-recover-bad");
    const good = makeInstance("A-recover-good");

    await expect(
      store.withTransaction(async (tx) => {
        await tx.saveInstance(bad);
        throw new Error("abort");
      })
    ).rejects.toThrow("abort");

    // No "idle in transaction"-style leftover on the pool; next
    // withTransaction behaves exactly as the first.
    await store.withTransaction(async (tx) => {
      await tx.saveInstance(good);
    });

    expect(await store.getInstance(good.aggregateId)).not.toBeNull();
    expect(await store.getInstance(bad.aggregateId)).toBeNull();
  });

  it("treats nested store.withTransaction as an independent transaction", async () => {
    // Outer acquires client1; inner (via the outer store, not via tx)
    // acquires client2. The two transactions commit/rollback
    // independently. This is the semantic we document: nesting via the
    // store is independent; extending atomicity across nested scopes
    // requires passing the outer `tx` to the inner operation and using
    // its LoopStore methods.
    const outerAgg = makeInstance("A-nested-outer");
    const innerAgg = makeInstance("A-nested-inner");

    await expect(
      store.withTransaction(async (tx) => {
        await tx.saveInstance(outerAgg);

        // Nested, independent: commits on its own client.
        await store.withTransaction(async (innerTx) => {
          await innerTx.saveInstance(innerAgg);
        });

        // Now abort the outer transaction.
        throw new Error("outer-rollback");
      })
    ).rejects.toThrow("outer-rollback");

    // Outer rolled back; inner's write persists.
    expect(await store.getInstance(outerAgg.aggregateId)).toBeNull();
    expect(await store.getInstance(innerAgg.aggregateId)).not.toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────
  // SR-016.5: error classification + connection-loss handling.
  //
  // The integration-test half of the classification surface. Unit-
  // level behavior (SQLSTATE mapping, connection-code mapping, kind
  // discriminant, etc.) is covered in `errors.test.ts`; these tests
  // verify the real-pg interactions: constraint violations pass
  // through with their SQLSTATE intact (no adapter-level wrapping),
  // and mid-tx connection loss surfaces as `TransactionIntegrityError`.
  // ──────────────────────────────────────────────────────────────────

  it("passes through pg constraint violations unchanged (no adapter wrapping)", async () => {
    // Triggers a primary-key violation on `loop_instances.aggregate_id`
    // by bypassing saveInstance's ON CONFLICT UPSERT and issuing a
    // raw INSERT through the outer pool. SQLSTATE 23505 must reach
    // the consumer unchanged — not wrapped into an
    // adapter-internal DuplicateKeyError. Consumers who want typed
    // handling pattern-match against .code themselves.
    const aggregateId = "A-constraint-passthrough";
    const instance = makeInstance(aggregateId);

    // Seed the row.
    await store.withTransaction(async (tx) => {
      await tx.saveInstance(instance);
    });

    // Attempt a raw INSERT with the same aggregate_id inside a new
    // transaction → 23505.
    const attempt = store.withTransaction(async (_tx) => {
      await ctx.pool.query(
        `
          INSERT INTO loop_instances (
            aggregate_id, loop_id, current_state, status, started_at, updated_at
          ) VALUES ($1, $2, $3, $4, NOW(), NOW())
        `,
        [aggregateId, "tx.test.loop", "OPEN", "active"]
      );
    });

    await expect(attempt).rejects.toMatchObject({ code: "23505" });
    await expect(attempt).rejects.not.toBeInstanceOf(TransactionIntegrityError);

    // The failed tx rolled back cleanly; subsequent transactions work.
    const followup = makeInstance("A-constraint-recover");
    await store.withTransaction(async (tx) => {
      await tx.saveInstance(followup);
    });
    expect(await store.getInstance(followup.aggregateId)).not.toBeNull();
  });

  it("classifies pass-through pg errors via classifyError", async () => {
    // Consumers use `classifyError` to drive retry logic. Confirm a
    // constraint-violation error is classified `"permanent"` so a
    // retry loop does the right thing (doesn't retry).
    const aggregateId = "A-classify";
    const instance = makeInstance(aggregateId);

    await store.withTransaction(async (tx) => {
      await tx.saveInstance(instance);
    });

    let pgErr: unknown;
    try {
      await store.withTransaction(async (_tx) => {
        await ctx.pool.query(
          `
            INSERT INTO loop_instances (
              aggregate_id, loop_id, current_state, status, started_at, updated_at
            ) VALUES ($1, $2, $3, $4, NOW(), NOW())
          `,
          [aggregateId, "tx.test.loop", "OPEN", "active"]
        );
      });
    } catch (err) {
      pgErr = err;
    }

    expect(pgErr).toBeDefined();
    expect(classifyError(pgErr)).toBe("permanent");
  });

  it("wraps mid-tx connection loss as TransactionIntegrityError (kind=transient)", async () => {
    // The subtlest surface in SR-016.5: the connection dies mid-fn.
    // The adapter-level rule (operator-adjudicated) is that when the
    // adapter cannot confirm a definite terminal state for the
    // transaction, it wraps as `TransactionIntegrityError` rather
    // than letting an opaque pg connection-error propagate as if
    // nothing special had happened.
    //
    // Deterministic trigger: after the tx has issued its first
    // query (putting the backend into `idle in transaction` state),
    // use an out-of-band connection to find that backend and
    // `pg_terminate_backend` it. The next query on the tx's client
    // must fail with a connection-class error; withTransaction's
    // subsequent ROLLBACK attempt also fails; the rule fires.
    //
    // Robustness concern mitigated by this sub-commit: pg clients
    // emit async `'error'` events on `FATAL` messages even when no
    // query is active. If `withTransaction` did not install an
    // error handler for the lifetime of its checked-out client,
    // the socket-level FATAL (`57P01`) delivered between
    // `pg_terminate_backend` and the next query would become an
    // uncaught exception and crash the consumer's process. The
    // adapter now installs a no-op handler; this test exercises
    // the real surface.

    const instance = makeInstance("A-mid-tx-loss");

    let caught: unknown;
    try {
      await store.withTransaction(async (tx) => {
        await tx.saveInstance(instance);

        // Identify the backend now sitting in `idle in transaction`
        // (that's us — we just INSERTed and returned from the
        // INSERT's round-trip) and terminate it via an out-of-band
        // connection.
        const killResult = await ctx.pool.query(
          `
            SELECT pg_terminate_backend(pid) AS killed
            FROM pg_stat_activity
            WHERE state = 'idle in transaction'
              AND datname = current_database()
              AND pid <> pg_backend_pid()
            LIMIT 1
          `
        );
        expect(killResult.rows.length).toBeGreaterThan(0);

        // The TCP close needs a moment to propagate to the pg-node
        // socket; the async FATAL arrives during this window. The
        // adapter's client-level `'error'` handler absorbs the
        // orphan event so this doesn't become an uncaught exception.
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Next tx operation: pg routes it to the now-broken
        // client. The query rejects with a connection-class error.
        // withTransaction catches, attempts ROLLBACK (which also
        // rejects because the socket is closed), and surfaces
        // `TransactionIntegrityError`.
        await tx.saveInstance(makeInstance("A-mid-tx-loss-followup"));
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(TransactionIntegrityError);
    if (caught instanceof TransactionIntegrityError) {
      expect(caught.kind).toBe("transient");
      expect(caught.cause).toBeDefined();
      expect(caught.message).toMatch(/indeterminate/i);
      // `classifyError` on the wrapper returns `"transient"` via the
      // PostgresStoreError's own kind — the retry decision is
      // consistent between the wrapper and the underlying cause
      // classification.
      expect(classifyError(caught)).toBe("transient");
    }

    // Pool recovers: the broken client is evicted by pg on release
    // (connection is dead → pg.Pool discards it rather than
    // returning it to the idle set), and a fresh connection serves
    // the next transaction cleanly.
    const followup = makeInstance("A-mid-tx-loss-recovered");
    await store.withTransaction(async (tx) => {
      await tx.saveInstance(followup);
    });
    expect(await store.getInstance(followup.aggregateId)).not.toBeNull();

    // The instance the failing tx tried to save was not committed —
    // Postgres rolled the tx back server-side when the backend died.
    expect(await store.getInstance(instance.aggregateId)).toBeNull();
  });

  it("extends atomicity across call sites when the inner uses the outer tx", async () => {
    // The documented pattern for atomic sequencing across multiple
    // call sites: pass the outer `tx` down rather than opening a new
    // store.withTransaction. This test validates that passing `tx` to
    // a helper that performs LoopStore operations makes those
    // operations part of the outer atomic scope.
    const outer = makeInstance("A-tx-passthrough-outer");
    const inner = makeInstance("A-tx-passthrough-inner");

    async function helperThatUsesTheTx(
      tx: Parameters<Parameters<PostgresStore["withTransaction"]>[0]>[0]
    ): Promise<void> {
      await tx.saveInstance(inner);
    }

    await expect(
      store.withTransaction(async (tx) => {
        await tx.saveInstance(outer);
        await helperThatUsesTheTx(tx);
        throw new Error("abort-both");
      })
    ).rejects.toThrow("abort-both");

    // Both rolled back — the helper operated under the outer tx.
    expect(await store.getInstance(outer.aggregateId)).toBeNull();
    expect(await store.getInstance(inner.aggregateId)).toBeNull();
  });
});

function makeInstance(aggregateId: string): LoopInstance {
  const now = new Date().toISOString();
  return {
    aggregateId: aggregateId as AggregateId,
    loopId: "tx.test.loop" as LoopId,
    currentState: "OPEN" as LoopInstance["currentState"],
    status: "active" as LoopInstance["status"],
    startedAt: now,
    updatedAt: now
  };
}

function makeTransitionRecord(
  aggregateId: string,
  transitionId: string
): TransitionRecord {
  return {
    loopId: "tx.test.loop" as TransitionRecord["loopId"],
    aggregateId: aggregateId as AggregateId,
    transitionId: transitionId as TransitionRecord["transitionId"],
    signal: "tx.test.signal" as TransitionRecord["signal"],
    fromState: "OPEN" as TransitionRecord["fromState"],
    toState: "CLOSED" as TransitionRecord["toState"],
    actor: {
      type: "system",
      id: "test-system"
    } as unknown as TransitionRecord["actor"],
    occurredAt: new Date().toISOString()
  };
}
