// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { AggregateId, LoopId, LoopInstance, TransitionRecord } from "@loop-engine/core";
import type { LoopStore } from "@loop-engine/runtime";

export type PgPoolLike = {
  query(sql: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
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
      orgId: asString(item.org_id),
      currentState: asString(item.current_state) as LoopInstance["currentState"],
      status: asString(item.status) as LoopInstance["status"],
      startedAt: new Date(asString(item.started_at)).toISOString(),
      ...(item.closed_at ? { closedAt: new Date(asString(item.closed_at)).toISOString() } : {}),
      correlationId: asString(item.correlation_id) as LoopInstance["correlationId"],
      ...(metadata && typeof metadata === "object" ? { metadata: metadata as Record<string, unknown> } : {})
    };
  }

  function asTransitionRecord(row: unknown): TransitionRecord {
    const item = asRecord(row);
    const actor = asRecord(item.actor);
    const evidence = item.evidence;
    return {
      id: asString(item.id),
      loopId: asString(item.loop_id) as TransitionRecord["loopId"],
      aggregateId: asString(item.aggregate_id) as TransitionRecord["aggregateId"],
      transitionId: asString(item.transition_id) as TransitionRecord["transitionId"],
      fromState: asString(item.from_state) as TransitionRecord["fromState"],
      toState: asString(item.to_state) as TransitionRecord["toState"],
      actor: {
        type: asString(actor.type) as TransitionRecord["actor"]["type"],
        id: asString(actor.id) as TransitionRecord["actor"]["id"],
        ...(typeof actor.displayName === "string" ? { displayName: actor.displayName } : {}),
        ...(typeof actor.sessionId === "string" ? { sessionId: actor.sessionId } : {}),
        ...(typeof actor.agentId === "string" ? { agentId: actor.agentId } : {})
      },
      evidence: evidence && typeof evidence === "object" ? (evidence as Record<string, unknown>) : {},
      occurredAt: new Date(asString(item.occurred_at)).toISOString(),
      ...(typeof item.duration_ms === "number" ? { durationMs: item.duration_ms } : {})
    };
  }

  return {
    async getInstance(aggregateId: AggregateId): Promise<LoopInstance | null> {
      const result = await _pool.query(
        `
          SELECT aggregate_id, loop_id, org_id, current_state, status, started_at, closed_at, correlation_id, metadata
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
      await _pool.query(
        `
          INSERT INTO loop_instances (
            aggregate_id, loop_id, org_id, current_state, status, started_at, closed_at, correlation_id, metadata
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (aggregate_id) DO UPDATE SET
            loop_id = EXCLUDED.loop_id,
            org_id = EXCLUDED.org_id,
            current_state = EXCLUDED.current_state,
            status = EXCLUDED.status,
            started_at = EXCLUDED.started_at,
            closed_at = EXCLUDED.closed_at,
            correlation_id = EXCLUDED.correlation_id,
            metadata = EXCLUDED.metadata
        `,
        [
          instance.aggregateId,
          instance.loopId,
          instance.orgId,
          instance.currentState,
          instance.status,
          instance.startedAt,
          instance.closedAt ?? null,
          instance.correlationId,
          instance.metadata ?? null
        ]
      );
    },
    async getTransitionHistory(aggregateId: AggregateId): Promise<TransitionRecord[]> {
      const result = await _pool.query(
        `
          SELECT id, loop_id, aggregate_id, transition_id, from_state, to_state, actor, evidence, occurred_at, duration_ms
          FROM loop_transitions
          WHERE aggregate_id = $1
          ORDER BY occurred_at ASC, id ASC
        `,
        [aggregateId]
      );
      return result.rows.map(asTransitionRecord);
    },
    async saveTransitionRecord(record: TransitionRecord): Promise<void> {
      await _pool.query(
        `
          INSERT INTO loop_transitions (
            id, loop_id, aggregate_id, transition_id, from_state, to_state, actor, evidence, occurred_at, duration_ms
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (id) DO UPDATE SET
            loop_id = EXCLUDED.loop_id,
            aggregate_id = EXCLUDED.aggregate_id,
            transition_id = EXCLUDED.transition_id,
            from_state = EXCLUDED.from_state,
            to_state = EXCLUDED.to_state,
            actor = EXCLUDED.actor,
            evidence = EXCLUDED.evidence,
            occurred_at = EXCLUDED.occurred_at,
            duration_ms = EXCLUDED.duration_ms
        `,
        [
          record.id,
          record.loopId,
          record.aggregateId,
          record.transitionId,
          record.fromState,
          record.toState,
          record.actor,
          record.evidence,
          record.occurredAt,
          record.durationMs ?? null
        ]
      );
    },
    async listOpenInstances(loopId: LoopId, orgId: string): Promise<LoopInstance[]> {
      const result = await _pool.query(
        `
          SELECT aggregate_id, loop_id, org_id, current_state, status, started_at, closed_at, correlation_id, metadata
          FROM loop_instances
          WHERE loop_id = $1
            AND org_id = $2
            AND status NOT IN ('CLOSED', 'ERROR', 'CANCELLED')
          ORDER BY started_at ASC, aggregate_id ASC
        `,
        [loopId, orgId]
      );
      return result.rows.map(asLoopInstance);
    }
  };
}
