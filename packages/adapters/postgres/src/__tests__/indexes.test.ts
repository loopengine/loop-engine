// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * SR-016.6 integration tests for index coverage.
 *
 * Verifies that `listOpenInstances(loopId)`'s query plan:
 *
 *   1. Uses `idx_loop_instances_loop_id_status` (first-class
 *      assertion — the index must be selected, not just exist).
 *   2. Does NOT sequential-scan `loop_instances` (first-class
 *      assertion — a plan could theoretically use the index for one
 *      predicate and still fall back to a seq scan elsewhere; we
 *      reject any seq scan on `loop_instances` in the plan tree).
 *
 * Both assertions run against a realistically-seeded table
 * (~10,000 rows across 10 loop_ids and 3 statuses) with `ANALYZE`
 * applied before the plan is inspected, so the planner's statistics
 * reflect real distributions and the plan it chooses is what a
 * production deployment would see.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runMigrations } from "../index";
import {
  POSTGRES_IMAGE_MATRIX,
  startPostgres,
  type PostgresImage,
  type PostgresTestContext
} from "./helpers/postgres";

/**
 * Shape of a single plan node in Postgres's `EXPLAIN (FORMAT JSON)`
 * output. Only the fields we introspect are typed; pg populates
 * many more (cost estimates, row counts, etc.) that we don't need.
 */
interface PlanNode {
  "Node Type": string;
  "Relation Name"?: string;
  "Index Name"?: string;
  Plans?: PlanNode[];
}

interface ExplainRow {
  Plan: PlanNode;
}

/**
 * Run the index-coverage suite against both matrix images. The
 * EXPLAIN JSON schema (`Node Type`, `Relation Name`, `Index Name`,
 * `Plans`) is stable across pg 13+, but covering both matrix images
 * guards against subtle planner behavior differences (e.g., pg 15
 * vs 16 may have different thresholds for Bitmap Index Scan vs
 * Index Scan selection) and catches any regressions at the earliest
 * opportunity.
 */
describe.each(POSTGRES_IMAGE_MATRIX)(
  "@loop-engine/adapter-postgres index coverage :: %s",
  (image: PostgresImage) => {
  let ctx: PostgresTestContext;

  beforeAll(async () => {
    ctx = await startPostgres(image);
    await runMigrations(ctx.pool);
    await seedRealisticInstances(ctx);

    // Update the planner's statistics to reflect the seeded data.
    // Without this, the planner falls back to default selectivity
    // estimates and may choose a seq scan regardless of row count.
    await ctx.pool.query("ANALYZE loop_instances");
  }, 60_000);

  afterAll(async () => {
    if (ctx) {
      await ctx.teardown();
    }
  });

  it("listOpenInstances plan uses idx_loop_instances_loop_id_status", async () => {
    const plan = await explainListOpenInstances(ctx, "loop-5");
    const usedIndex = planUsesIndex(
      plan,
      "idx_loop_instances_loop_id_status"
    );
    expect(usedIndex).toBe(true);
  });

  it("listOpenInstances plan does NOT sequential-scan loop_instances", async () => {
    // First-class assertion separate from the index-usage check: a
    // plan could use the index for one predicate (e.g., the loop_id
    // equality) and still fall back to a seq scan for the status
    // filter on a second pass. The listOpenInstances query is
    // narrow enough that no such pattern is expected, but the test
    // asserts the absence of seq scans on `loop_instances`
    // explicitly so a future planner-behavior regression can't hide
    // behind a "well, it used the index somewhere" pass.
    const plan = await explainListOpenInstances(ctx, "loop-5");
    const seqScanned = planContainsSeqScan(plan, "loop_instances");
    expect(seqScanned).toBe(false);
  });

  it("the index exists in pg_indexes after runMigrations", async () => {
    // Smoke-level confirmation that migration 004 created the index,
    // independent of whether the planner actually selected it. Guards
    // against the failure mode where the index is absent and the
    // planner picks a seq scan for a valid "use the fastest option"
    // reason — in that case the earlier assertions would fail but
    // the diagnostic would be unclear; this test surfaces the
    // "index missing" root cause directly.
    const result = await ctx.pool.query<{ indexname: string }>(
      `
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'loop_instances'
          AND indexname = $1
      `,
      ["idx_loop_instances_loop_id_status"]
    );
    expect(result.rows.length).toBe(1);
  });
  }
);

/**
 * Run `EXPLAIN (ANALYZE, FORMAT JSON)` for the `listOpenInstances`
 * query and return the root plan node. ANALYZE actually executes
 * the query (so the plan reflects what really happened, not just
 * what the planner estimated).
 */
async function explainListOpenInstances(
  ctx: PostgresTestContext,
  loopId: string
): Promise<PlanNode> {
  const result = await ctx.pool.query<{ "QUERY PLAN": ExplainRow[] }>(
    `
      EXPLAIN (ANALYZE, FORMAT JSON)
      SELECT aggregate_id, loop_id, current_state, status, started_at, updated_at, completed_at, correlation_id, metadata
      FROM loop_instances
      WHERE loop_id = $1
        AND status = 'active'
      ORDER BY started_at ASC, aggregate_id ASC
    `,
    [loopId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("EXPLAIN returned no rows");
  }
  const planWrapper = row["QUERY PLAN"][0];
  if (!planWrapper) {
    throw new Error("EXPLAIN QUERY PLAN array is empty");
  }
  return planWrapper.Plan;
}

/** Depth-first walk over a plan tree. */
function walk(node: PlanNode, visit: (n: PlanNode) => void): void {
  visit(node);
  for (const child of node.Plans ?? []) {
    walk(child, visit);
  }
}

function planUsesIndex(plan: PlanNode, indexName: string): boolean {
  let found = false;
  walk(plan, (node) => {
    if (node["Index Name"] === indexName) {
      found = true;
    }
  });
  return found;
}

function planContainsSeqScan(plan: PlanNode, relationName: string): boolean {
  let found = false;
  walk(plan, (node) => {
    if (
      node["Node Type"] === "Seq Scan" &&
      node["Relation Name"] === relationName
    ) {
      found = true;
    }
  });
  return found;
}

/**
 * Seed ~10,000 instances across 10 loop_ids × 3 statuses using a
 * single server-side `generate_series` INSERT so the setup cost is
 * one round-trip rather than 10,000. Chosen to give the planner
 * enough data that seq scan is meaningfully more expensive than
 * an index scan for the selective predicate.
 *
 * Distribution:
 *   - 10 loop_ids (`loop-0` through `loop-9`)
 *   - 3 statuses (`active`, `completed`, `failed`) cycled via modulo
 *   - ~333 active instances per loop, ~333 completed, ~334 failed
 */
async function seedRealisticInstances(
  ctx: PostgresTestContext
): Promise<void> {
  await ctx.pool.query(`
    INSERT INTO loop_instances (
      aggregate_id, loop_id, current_state, status, started_at, updated_at
    )
    SELECT
      'agg-' || gs::text AS aggregate_id,
      'loop-' || (gs % 10)::text AS loop_id,
      'OPEN' AS current_state,
      (ARRAY['active', 'completed', 'failed'])[1 + (gs % 3)] AS status,
      NOW() - (gs || ' seconds')::interval AS started_at,
      NOW() AS updated_at
    FROM generate_series(1, 10000) gs
  `);
}
