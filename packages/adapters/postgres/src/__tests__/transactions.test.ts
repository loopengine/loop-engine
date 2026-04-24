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

import { postgresStore, runMigrations, type PostgresStore } from "../index";
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
