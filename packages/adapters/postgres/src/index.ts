// @license MIT
// SPDX-License-Identifier: MIT
import type { AggregateId, LoopId, LoopInstance, TransitionRecord } from "@loopengine/core";
import type { LoopStore } from "@loopengine/runtime";

export type PgPoolLike = {
  query(sql: string, values?: unknown[]): Promise<{ rows: any[] }>;
};

export async function createSchema(pool: PgPoolLike): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loop_instances (
      aggregate_id TEXT PRIMARY KEY,
      loop_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      current_state TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      closed_at TIMESTAMPTZ NULL,
      correlation_id TEXT NOT NULL,
      metadata JSONB NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loop_transitions (
      id TEXT PRIMARY KEY,
      loop_id TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      transition_id TEXT NOT NULL,
      from_state TEXT NOT NULL,
      to_state TEXT NOT NULL,
      actor JSONB NOT NULL,
      evidence JSONB NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      duration_ms INTEGER NULL
    );
  `);
}

export function postgresStore(_pool: PgPoolLike): LoopStore {
  return {
    async getInstance(_aggregateId: AggregateId): Promise<LoopInstance | null> {
      throw new Error("postgresStore runtime implementation pending");
    },
    async saveInstance(_instance: LoopInstance): Promise<void> {
      throw new Error("postgresStore runtime implementation pending");
    },
    async getTransitionHistory(_aggregateId: AggregateId): Promise<TransitionRecord[]> {
      throw new Error("postgresStore runtime implementation pending");
    },
    async saveTransitionRecord(_record: TransitionRecord): Promise<void> {
      throw new Error("postgresStore runtime implementation pending");
    },
    async listOpenInstances(_loopId: LoopId, _orgId: string): Promise<LoopInstance[]> {
      throw new Error("postgresStore runtime implementation pending");
    }
  };
}
