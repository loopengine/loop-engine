// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * SR-016.1 smoke test — integration-test infrastructure gate.
 *
 * This file is intentionally minimal. Its sole purpose is to prove:
 *
 *   1. Testcontainers can spin up a real Postgres instance on this host.
 *   2. `@loop-engine/adapter-postgres`'s `createSchema` actually runs against
 *      a live Postgres and provisions the expected tables.
 *   3. Both matrix versions (Postgres 15, 16) behave equivalently for this
 *      minimal case.
 *
 * It is NOT a functional test of the adapter's `LoopStore` methods — those
 * land in SR-016.2+ (migration versioning), SR-016.3 (transactions),
 * SR-016.4 (pool config), SR-016.5 (error mapping). This file is the
 * infrastructure gate that unblocks those sub-commits.
 *
 * Design note: `describe.each` produces two independent describe blocks, one
 * per matrix image. Each block spins its own container in `beforeAll` and
 * tears down in `afterAll`. The vitest config serializes test files via
 * `singleFork` so these describes run sequentially (not concurrently);
 * running two Postgres containers simultaneously is fine at current
 * resource ceilings but serializing keeps the resource floor lower for
 * CI environments with tighter constraints.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSchema } from "../index";
import {
  POSTGRES_IMAGE_MATRIX,
  startPostgres,
  type PostgresImage,
  type PostgresTestContext
} from "./helpers/postgres";

describe.each(POSTGRES_IMAGE_MATRIX)(
  "@loop-engine/adapter-postgres smoke :: %s",
  (image: PostgresImage) => {
    let ctx: PostgresTestContext;

    beforeAll(async () => {
      ctx = await startPostgres(image);
    });

    afterAll(async () => {
      if (ctx) {
        await ctx.teardown();
      }
    });

    it("docker daemon reachable + container spins up", () => {
      // If beforeAll succeeded, this is already proven. Kept as an explicit
      // assertion so the infra gate is a line in the test output, not an
      // implicit side effect of the beforeAll hook.
      expect(ctx.container).toBeDefined();
      expect(ctx.pool).toBeDefined();
    });

    it("pg.Pool structurally satisfies PgPoolLike (adapter input contract)", async () => {
      // The adapter accepts a `PgPoolLike` duck-type; `pg.Pool` must
      // structurally satisfy it. If this assertion surfaces a shape
      // mismatch, the adapter's input contract has drifted from `pg.Pool`'s
      // actual runtime shape and SR-016.1 halts for adjudication.
      const result = await ctx.pool.query("SELECT 1 AS one");
      expect(result.rows).toEqual([{ one: 1 }]);
    });

    it("createSchema provisions loop_instances and loop_transitions tables", async () => {
      await createSchema(ctx.pool);

      const result = await ctx.pool.query<{ table_name: string }>(
        `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name
        `
      );
      const tables = result.rows.map((r) => r.table_name);
      expect(tables).toEqual(["loop_instances", "loop_transitions"]);
    });

    it("createSchema is idempotent (second call is a no-op)", async () => {
      // createSchema uses CREATE TABLE IF NOT EXISTS; running it twice on an
      // already-provisioned instance must succeed without error and without
      // duplicating tables. This invariant backs SR-016.2's future migration
      // versioning, where migration 001 (the equivalent of `createSchema`)
      // must re-apply cleanly on a partially-migrated instance.
      await createSchema(ctx.pool);
      await createSchema(ctx.pool);

      const result = await ctx.pool.query<{ table_name: string }>(
        `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name
        `
      );
      expect(result.rows.map((r) => r.table_name)).toEqual([
        "loop_instances",
        "loop_transitions"
      ]);
    });
  }
);
