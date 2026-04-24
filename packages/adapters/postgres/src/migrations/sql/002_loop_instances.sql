-- Migration 002: loop_instances table
--
-- One row per aggregate_id; upserted by `LoopStore.saveInstance`. Current
-- state of each loop aggregate.
--
-- IDEMPOTENCY: `CREATE TABLE IF NOT EXISTS` lets this migration be
-- re-applied safely; the runner additionally records it in
-- `schema_migrations` after first application so subsequent runs skip it.

CREATE TABLE IF NOT EXISTS loop_instances (
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
