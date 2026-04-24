-- Migration 001: schema_migrations tracking table
--
-- BOOTSTRAP MIGRATION. Creates the `schema_migrations` table that the runner
-- uses to record which migrations have been applied. This is the one
-- migration whose idempotency cannot be backed by a row-in-schema_migrations
-- check (the table does not exist until this migration creates it); the
-- runner's pre-flight bootstrap handles that case by checking
-- `information_schema.tables` for this table before attempting any lookup
-- against it.
--
-- IDEMPOTENCY GUARANTEE: `CREATE TABLE IF NOT EXISTS` makes this statement
-- safe to re-apply. The runner additionally records its application in
-- the table itself, so subsequent runs skip it via the normal path.
--
-- SCHEMA STABILITY: The `id` + `applied_at` columns are required by the
-- runner. The `checksum` column backs drift detection (the runner refuses
-- to re-apply a migration whose recorded checksum no longer matches the
-- on-disk SQL, guarding against the foot-gun of editing an applied
-- migration). All three columns are load-bearing; do not remove them in a
-- future migration.

CREATE TABLE IF NOT EXISTS schema_migrations (
  id         TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum   TEXT NOT NULL
);
