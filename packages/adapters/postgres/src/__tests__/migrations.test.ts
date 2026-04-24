// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * SR-016.2 integration tests for the migration runner.
 *
 * Exercises each runner invariant against a real Postgres instance:
 *
 *   - Forward idempotency: fresh DB → all migrations apply; second call
 *     is a no-op.
 *   - Bootstrap: the `schema_migrations` table is created by migration
 *     001 itself; the runner tolerates its absence on first run.
 *   - Partial-state recovery: operator-applied DDL without recording in
 *     `schema_migrations` is detected and recovered gracefully (the
 *     runner re-applies since the row is missing; the `CREATE TABLE IF
 *     NOT EXISTS` guard inside each migration is what makes this safe).
 *   - Advisory-lock serialization: concurrent `runMigrations` calls
 *     don't race or duplicate work.
 *   - Checksum drift detection: editing an applied migration's SQL
 *     content raises a loud error on the next run.
 *
 * Tests run against Postgres 16 only (not the full matrix). SR-016.1's
 * smoke test proved infrastructure-level version compatibility; these
 * tests exercise runner logic that is version-independent. Dropping 15
 * here cuts the test run roughly in half and keeps per-sub-commit test
 * wall-clock time proportional to what the runner actually depends on.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { loadMigrations, runMigrations } from "../migrations/runner";
import { startPostgres, type PostgresTestContext } from "./helpers/postgres";

describe("@loop-engine/adapter-postgres migration runner", () => {
  let ctx: PostgresTestContext;

  beforeAll(async () => {
    ctx = await startPostgres("postgres:16-alpine");
  });

  afterAll(async () => {
    if (ctx) {
      await ctx.teardown();
    }
  });

  beforeEach(async () => {
    // Reset the DB between tests by dropping every `public` table. Each
    // test then starts from a fresh migration state.
    await ctx.pool.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (
          SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        ) LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
  });

  it("applies all migrations on a fresh database", async () => {
    const result = await runMigrations(ctx.pool);

    expect(result.applied).toEqual([
      "001_schema_migrations",
      "002_loop_instances",
      "003_loop_transitions",
      "004_idx_loop_instances_loop_id_status"
    ]);
    expect(result.skipped).toEqual([]);

    const tables = await listPublicTables(ctx);
    expect(tables).toEqual([
      "loop_instances",
      "loop_transitions",
      "schema_migrations"
    ]);
  });

  it("is forward-idempotent: second run is a no-op", async () => {
    await runMigrations(ctx.pool);

    const secondRun = await runMigrations(ctx.pool);
    expect(secondRun.applied).toEqual([]);
    expect(secondRun.skipped).toEqual([
      "001_schema_migrations",
      "002_loop_instances",
      "003_loop_transitions",
      "004_idx_loop_instances_loop_id_status"
    ]);

    // Tables still match the canonical set — no duplication, no drift.
    // (Indexes don't appear in the public-tables list.)
    const tables = await listPublicTables(ctx);
    expect(tables).toEqual([
      "loop_instances",
      "loop_transitions",
      "schema_migrations"
    ]);
  });

  it("tolerates bootstrap absence of schema_migrations", async () => {
    // Freshly-dropped DB (via beforeEach) lacks schema_migrations. The
    // runner's bootstrap check must not try to SELECT from it.
    const tableExistsBefore = await publicTableExists(ctx, "schema_migrations");
    expect(tableExistsBefore).toBe(false);

    const result = await runMigrations(ctx.pool);
    expect(result.applied).toContain("001_schema_migrations");

    const tableExistsAfter = await publicTableExists(ctx, "schema_migrations");
    expect(tableExistsAfter).toBe(true);
  });

  it("recovers from partial state where tables exist but records don't", async () => {
    // Simulate the "operator applied some DDL via psql without going
    // through the runner" scenario. We create loop_instances manually,
    // then invoke runMigrations. The runner should detect that
    // schema_migrations doesn't exist, treat every migration as new, and
    // the CREATE TABLE IF NOT EXISTS inside 002 should no-op safely.
    await ctx.pool.query(`
      CREATE TABLE loop_instances (
        aggregate_id   TEXT PRIMARY KEY,
        loop_id        TEXT NOT NULL,
        current_state  TEXT NOT NULL,
        status         TEXT NOT NULL,
        started_at     TIMESTAMPTZ NOT NULL,
        updated_at     TIMESTAMPTZ NOT NULL,
        completed_at   TIMESTAMPTZ NULL,
        correlation_id TEXT NULL,
        metadata       JSONB NULL
      );
    `);

    const result = await runMigrations(ctx.pool);
    expect(result.applied).toEqual([
      "001_schema_migrations",
      "002_loop_instances",
      "003_loop_transitions",
      "004_idx_loop_instances_loop_id_status"
    ]);

    // All three tables exist; no error was thrown during 002's
    // application even though loop_instances was pre-provisioned.
    const tables = await listPublicTables(ctx);
    expect(tables).toEqual([
      "loop_instances",
      "loop_transitions",
      "schema_migrations"
    ]);

    // And the second run is still a clean no-op.
    const secondRun = await runMigrations(ctx.pool);
    expect(secondRun.applied).toEqual([]);
  });

  it("serializes concurrent runMigrations calls via advisory lock", async () => {
    // Fire three concurrent calls against the same pool. Without the
    // advisory lock, two callers could both try to INSERT the same
    // migration ID and one would fail with a PRIMARY KEY violation.
    // With the lock, exactly one sees applied: [...all migrations...]
    // and the other two see skipped: [...all migrations...].
    const results = await Promise.all([
      runMigrations(ctx.pool),
      runMigrations(ctx.pool),
      runMigrations(ctx.pool)
    ]);

    const appliedCounts = results.map((r) => r.applied.length);
    const skippedCounts = results.map((r) => r.skipped.length);

    // Exactly one caller applied all migrations; the others saw
    // everything already applied. Count tracks the shipped-migration
    // count dynamically so adding a migration doesn't require updating
    // this test's magic numbers (only the `applied`-list tests above).
    const { length: totalMigrations } = await loadMigrations();
    const expectedApplied = [0, 0, totalMigrations].sort();
    const expectedSkipped = [0, totalMigrations, totalMigrations].sort();
    expect(appliedCounts.sort()).toEqual(expectedApplied);
    expect(skippedCounts.sort()).toEqual(expectedSkipped);

    const countResult = await ctx.pool.query(
      `SELECT COUNT(*)::int AS c FROM schema_migrations`
    );
    expect((countResult.rows[0] as { c: number }).c).toBe(totalMigrations);
  });

  it("detects checksum drift on an already-applied migration", async () => {
    await runMigrations(ctx.pool);

    // Forge drift by flipping the recorded checksum to something that
    // cannot match any real migration's SHA-256. This simulates the
    // foot-gun case: an operator edits an applied migration file; on
    // the next run, the recorded checksum (original) no longer matches
    // the on-disk checksum (edited). The simulation is easier to
    // arrange by corrupting the row than by editing a shipped file.
    await ctx.pool.query(
      `UPDATE schema_migrations SET checksum = $1 WHERE id = $2`,
      ["deadbeef".repeat(8), "002_loop_instances"]
    );

    await expect(runMigrations(ctx.pool)).rejects.toThrow(
      /Migration "002_loop_instances" has been modified since it was applied/
    );
  });

  it("loadMigrations exposes the on-disk view for auditing", async () => {
    // Independent of the runner. Consumers can introspect which
    // migrations ship in a given package version without running them.
    const migrations = await loadMigrations();
    expect(migrations.map((m) => m.id)).toEqual([
      "001_schema_migrations",
      "002_loop_instances",
      "003_loop_transitions",
      "004_idx_loop_instances_loop_id_status"
    ]);
    // Every migration has a non-empty SQL body and a 64-char hex
    // checksum (SHA-256).
    for (const m of migrations) {
      expect(m.sql.length).toBeGreaterThan(0);
      expect(m.checksum).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

async function listPublicTables(ctx: PostgresTestContext): Promise<string[]> {
  const result = await ctx.pool.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
  );
  return result.rows.map((r) => r.table_name);
}

async function publicTableExists(
  ctx: PostgresTestContext,
  name: string
): Promise<boolean> {
  const result = await ctx.pool.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
      LIMIT 1
    `,
    [name]
  );
  return result.rows.length > 0;
}
