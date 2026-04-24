// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * SR-016.4 integration tests for `createPool(...)`.
 *
 * Covers:
 *
 *   - Defaults are applied when called with an empty options object.
 *   - Consumer overrides take precedence over defaults.
 *   - `statement_timeout` is enforced server-side (via libpq `options`
 *     connection parameter wiring).
 *   - `connectionTimeoutMillis` fires when the pool is saturated and
 *     a new `connect()` cannot be served within the deadline.
 *   - Exhaust-and-recover: when a held client is released back to a
 *     saturated pool, the next waiting `connect()` resolves
 *     immediately.
 *   - Consumer-supplied `options` strings are preserved alongside the
 *     statement_timeout clause.
 *
 * All tests spin up an isolated Postgres 16 container per test case
 * because the adapter tests deliberately avoid cross-test mutation of
 * shared pools (pool config is a per-Pool property; a single container
 * with many small pools keeps timeout semantics clean). Startup cost
 * is amortized by pointing every pool at the same container URL.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createPool,
  DEFAULT_POOL_OPTIONS,
  type PoolOptions
} from "../pool";
import { startPostgres, type PostgresTestContext } from "./helpers/postgres";

describe("@loop-engine/adapter-postgres createPool", () => {
  let ctx: PostgresTestContext;
  let connectionString: string;

  beforeAll(async () => {
    ctx = await startPostgres("postgres:16-alpine");
    connectionString = ctx.connectionString;
  });

  afterAll(async () => {
    if (ctx) {
      await ctx.teardown();
    }
  });

  it("exposes DEFAULT_POOL_OPTIONS with the six-decision adjudication values", () => {
    // Pin the contract so changes to defaults are explicit code edits
    // rather than silent drifts.
    expect(DEFAULT_POOL_OPTIONS).toEqual({
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 30_000
    });
  });

  it("applies DEFAULT_POOL_OPTIONS when called with no overrides", async () => {
    const pool = createPool({ connectionString });
    try {
      // `pg.Pool` exposes its resolved config via `.options`. This is
      // undocumented internal state but stable across pg 8.x — we
      // assert against it because there's no public API for
      // introspecting a pool's configured max/timeouts.
      const opts = (pool as unknown as { options: Record<string, unknown> }).options;
      expect(opts.max).toBe(DEFAULT_POOL_OPTIONS.max);
      expect(opts.idleTimeoutMillis).toBe(DEFAULT_POOL_OPTIONS.idleTimeoutMillis);
      expect(opts.connectionTimeoutMillis).toBe(
        DEFAULT_POOL_OPTIONS.connectionTimeoutMillis
      );
      // statement_timeout is wired via libpq `options`, so it shows
      // up there as the expected `-c` clause.
      expect(opts.options).toMatch(/-c statement_timeout=30000/);
    } finally {
      await pool.end();
    }
  });

  it("applies consumer overrides over defaults", async () => {
    const pool = createPool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 1_000,
      statement_timeout: 2_000
    });
    try {
      const opts = (pool as unknown as { options: Record<string, unknown> }).options;
      expect(opts.max).toBe(5);
      expect(opts.idleTimeoutMillis).toBe(10_000);
      expect(opts.connectionTimeoutMillis).toBe(1_000);
      expect(opts.options).toMatch(/-c statement_timeout=2000/);
    } finally {
      await pool.end();
    }
  });

  it("enforces statement_timeout server-side", async () => {
    // 250ms timeout; pg_sleep(1) tries to block for 1 full second;
    // Postgres must cancel the query with SQLSTATE 57014
    // (query_canceled) before the sleep completes.
    const pool = createPool({ connectionString, statement_timeout: 250 });
    try {
      await expect(pool.query("SELECT pg_sleep(1)")).rejects.toMatchObject({
        // pg surfaces the Postgres-side canceled-query error as an
        // instance of pg's DatabaseError with `code: '57014'`.
        code: "57014"
      });
    } finally {
      await pool.end();
    }
  });

  it("respects a consumer-supplied `options` string alongside statement_timeout", async () => {
    // Passing `options: '-c search_path=public'` should compose with
    // our statement_timeout clause rather than replacing it. We verify
    // via the .options string because both clauses round-trip to the
    // server as connection parameters.
    const options: PoolOptions = {
      connectionString,
      options: "-c application_name=loop_engine_test",
      statement_timeout: 5_000
    };
    const pool = createPool(options);
    try {
      const resolvedOptions = (
        pool as unknown as { options: Record<string, unknown> }
      ).options;
      expect(resolvedOptions.options).toMatch(/-c application_name=loop_engine_test/);
      expect(resolvedOptions.options).toMatch(/-c statement_timeout=5000/);

      // Smoke-check the application_name actually landed on the
      // session: pg's current_setting reflects the GUC set by the
      // libpq options string.
      const result = await pool.query(
        "SELECT current_setting('application_name') AS app_name"
      );
      expect(
        (result.rows[0] as { app_name: string }).app_name
      ).toBe("loop_engine_test");
    } finally {
      await pool.end();
    }
  });

  it("fires connectionTimeoutMillis when the pool is saturated", async () => {
    // max=2, short connectionTimeoutMillis so the test is fast.
    const pool = createPool({
      connectionString,
      max: 2,
      connectionTimeoutMillis: 300,
      idleTimeoutMillis: 10_000
    });
    try {
      const c1 = await pool.connect();
      const c2 = await pool.connect();
      try {
        // Third connect should queue, then fail after 300ms.
        await expect(pool.connect()).rejects.toThrow(
          /timeout exceeded when trying to connect/i
        );
      } finally {
        c1.release();
        c2.release();
      }
    } finally {
      await pool.end();
    }
  });

  it("recovers after exhaustion once a client is released", async () => {
    // The core exhaust-and-recover scenario called out explicitly by
    // the operator framing: saturate the pool at max=2, hold both
    // clients, fire a third connect() into the queue, release one of
    // the held clients, and verify the queued connect() resolves.
    const pool = createPool({
      connectionString,
      max: 2,
      connectionTimeoutMillis: 5_000, // wide enough to not race the release
      idleTimeoutMillis: 10_000
    });
    try {
      const c1 = await pool.connect();
      const c2 = await pool.connect();

      // Third connect is queued — don't await it yet, kick off in
      // parallel with the release.
      const queuedConnect = pool.connect();

      // Small delay to ensure the third connect has actually reached
      // the queue (not strictly required because connectionTimeoutMillis
      // is generous, but it makes the intent explicit).
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Release one of the held clients — the queued connect should
      // pick up the freed slot.
      c1.release();

      const c3 = await queuedConnect;
      try {
        // Verify the recovered client is usable.
        const result = await c3.query("SELECT 1 AS ok");
        expect((result.rows[0] as { ok: number }).ok).toBe(1);
      } finally {
        c3.release();
        c2.release();
      }
    } finally {
      await pool.end();
    }
  });
});
