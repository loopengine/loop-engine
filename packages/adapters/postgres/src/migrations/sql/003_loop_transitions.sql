-- Migration 003: loop_transitions table
--
-- Append-only log of every loop state transition. Ordered by
-- (occurred_at, id) for deterministic history retrieval.
--
-- IDEMPOTENCY: `CREATE TABLE IF NOT EXISTS` lets this migration be
-- re-applied safely; the runner additionally records it in
-- `schema_migrations` after first application so subsequent runs skip it.

CREATE TABLE IF NOT EXISTS loop_transitions (
  id            BIGSERIAL PRIMARY KEY,
  loop_id       TEXT NOT NULL,
  aggregate_id  TEXT NOT NULL,
  transition_id TEXT NOT NULL,
  signal        TEXT NOT NULL,
  from_state    TEXT NOT NULL,
  to_state      TEXT NOT NULL,
  actor         JSONB NOT NULL,
  evidence      JSONB NULL,
  occurred_at   TIMESTAMPTZ NOT NULL
);
