// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * Migration runner for `@loop-engine/adapter-postgres`.
 *
 * DESIGN PER SR-016.2 OPERATOR DECISION:
 *
 *   "Raw SQL + custom runner (~50 LOC)" — over `node-pg-migrate`, `umzug`,
 *   or similar framework tools. Rationale from the operator adjudication:
 *   the adapter owns two domain tables forever unless D-12 scope expands
 *   dramatically; a ~50-LOC runner that reads SQL files, tracks applied
 *   migrations in a `schema_migrations` table, and runs the next pending
 *   one is code an operator can audit in an afternoon. Framework tools
 *   have opinions buried in configuration that take longer to understand
 *   than the problem they solve.
 *
 * RUNNER INVARIANTS:
 *
 *   1. Migrations must be idempotent. The runner records each application
 *      in `schema_migrations` and refuses to re-apply. Additionally, every
 *      shipped migration uses `CREATE TABLE IF NOT EXISTS` as a
 *      belt-and-suspenders guard against the pre-recording window (a
 *      crash between SQL application and INSERT INTO schema_migrations).
 *
 *   2. Migrations must be immutable after application. The runner records
 *      a SHA-256 checksum of each migration's SQL content and refuses to
 *      run if a recorded migration's current checksum has drifted —
 *      guarding against the foot-gun of editing an applied migration. To
 *      change the schema, add a new migration file.
 *
 *   3. Each migration applies in a transaction. The SQL body and the
 *      INSERT INTO `schema_migrations` are committed atomically; a crash
 *      mid-migration leaves the database unchanged and the next run
 *      retries cleanly.
 *
 *   4. Concurrent runs are serialized via a Postgres advisory lock. Two
 *      processes calling `runMigrations` against the same database will
 *      not apply a migration twice; the second caller blocks, then sees
 *      the first caller's recordings and skips every migration.
 *
 *   5. The bootstrap migration (001_*) creates the `schema_migrations`
 *      table itself. Before running any migration, the runner checks
 *      `information_schema.tables` for this table; if absent, every
 *      migration is treated as new. After 001_* applies, the table
 *      exists and normal-path lookup resumes.
 */

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { PgClientLike, PgPoolLike } from "../index";

/**
 * Postgres advisory lock key for the migration runner. Arbitrary stable
 * `bigint`; the specific value is not meaningful beyond being unique to
 * this adapter so concurrent `runMigrations` callers serialize. Using a
 * value outside the typical application-code hash-of-table-name space
 * reduces accidental collision with any consumer-side advisory lock
 * usage.
 */
const ADVISORY_LOCK_KEY = "7305716497408247301";

const MIGRATIONS_TABLE = "schema_migrations";

/**
 * A single migration. `id` is the filename minus `.sql` extension
 * (e.g. `"001_schema_migrations"`); `sql` is the file contents;
 * `checksum` is the SHA-256 hex digest of `sql`.
 */
export interface Migration {
  id: string;
  sql: string;
  checksum: string;
}

/**
 * Outcome of a `runMigrations` call. `applied` lists migration IDs newly
 * applied during this call; `skipped` lists IDs that were already
 * recorded as applied. Ordering within each array matches the canonical
 * sort order of the migrations on disk.
 */
export interface MigrationRunResult {
  applied: string[];
  skipped: string[];
}

export interface RunMigrationsOptions {
  /**
   * Absolute path to a directory containing `*.sql` migration files. If
   * omitted, resolves to `<this-file-dir>/sql` — i.e. the `migrations/sql`
   * directory that ships with the adapter's `dist/`. Consumers supply an
   * explicit directory when they want to layer additional migrations on
   * top of the adapter's baseline (uncommon; reserved for advanced
   * deployments).
   */
  migrationsDir?: string;
}

/**
 * Tsup emits with `shims: true`; `__dirname` resolves correctly in both
 * the CJS (`dist/index.cjs`) and ESM (`dist/index.js`) builds. During
 * `vitest` runs against uncompiled TS, `import.meta.url` is the
 * authoritative source; we prefer it when available and fall back to
 * `__dirname` otherwise for CJS compatibility.
 */
function defaultMigrationsDir(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metaUrl: string | undefined = (import.meta as any)?.url;
    if (metaUrl) {
      return join(dirname(fileURLToPath(metaUrl)), "sql");
    }
  } catch {
    // Fall through to __dirname.
  }
  return join(__dirname, "sql");
}

/**
 * Load and sort migrations from disk. Exposed for consumers who want to
 * audit the runner's on-disk view without applying anything (e.g., to
 * assert via tests that a specific migration file ships in a release).
 */
export async function loadMigrations(dir?: string): Promise<Migration[]> {
  const resolvedDir = dir ?? defaultMigrationsDir();
  const entries = await readdir(resolvedDir);
  const sqlFiles = entries.filter((f) => f.endsWith(".sql")).sort();

  const migrations: Migration[] = [];
  for (const file of sqlFiles) {
    const sql = await readFile(join(resolvedDir, file), "utf8");
    const id = file.replace(/\.sql$/, "");
    const checksum = createHash("sha256").update(sql).digest("hex");
    migrations.push({ id, sql, checksum });
  }
  return migrations;
}

/**
 * Apply all pending migrations. Idempotent: calling this on a
 * fully-migrated database is a no-op (returns `applied: []`).
 *
 * On a fresh database, runs every shipped migration in numeric order
 * inside its own transaction, recording each application in
 * `schema_migrations`. On a partially-migrated database (e.g.,
 * interrupted prior run, or operator-side direct SQL applied without
 * recording), picks up from the first unrecorded migration.
 *
 * Advisory-lock-serialized: concurrent callers will not race. The
 * second caller blocks until the first releases, then sees every
 * migration already recorded and returns with `applied: []`.
 *
 * Throws on checksum drift: if a migration was modified after being
 * recorded, the runner refuses to proceed. This is a foot-gun guard.
 */
export async function runMigrations(
  pool: PgPoolLike,
  options: RunMigrationsOptions = {}
): Promise<MigrationRunResult> {
  const migrations = await loadMigrations(options.migrationsDir);
  if (migrations.length === 0) {
    return { applied: [], skipped: [] };
  }

  const client = await pool.connect();
  let lockAcquired = false;
  try {
    await client.query(`SELECT pg_advisory_lock($1::bigint)`, [ADVISORY_LOCK_KEY]);
    lockAcquired = true;

    const tableExists = await schemaMigrationsTableExists(client);
    const alreadyApplied = tableExists
      ? await loadAppliedMigrations(client)
      : new Map<string, string>();

    const applied: string[] = [];
    const skipped: string[] = [];

    for (const migration of migrations) {
      const recordedChecksum = alreadyApplied.get(migration.id);
      if (recordedChecksum !== undefined) {
        if (recordedChecksum !== migration.checksum) {
          throw new Error(
            [
              `[@loop-engine/adapter-postgres] Migration "${migration.id}" has been modified since it was applied.`,
              `  Recorded checksum: ${recordedChecksum}`,
              `  Current checksum:  ${migration.checksum}`,
              ``,
              `Migrations must be immutable after being applied. To change schema,`,
              `add a new migration file with a later numeric prefix.`
            ].join("\n")
          );
        }
        skipped.push(migration.id);
        continue;
      }

      await applyMigration(client, migration);
      applied.push(migration.id);
    }

    return { applied, skipped };
  } finally {
    if (lockAcquired) {
      try {
        await client.query(`SELECT pg_advisory_unlock($1::bigint)`, [ADVISORY_LOCK_KEY]);
      } catch {
        // Session-end will release the lock automatically; swallow so we
        // don't mask a real migration error with a lock-release error.
      }
    }
    client.release();
  }
}

async function schemaMigrationsTableExists(client: PgClientLike): Promise<boolean> {
  const result = await client.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = $1
      LIMIT 1
    `,
    [MIGRATIONS_TABLE]
  );
  return result.rows.length > 0;
}

async function loadAppliedMigrations(client: PgClientLike): Promise<Map<string, string>> {
  const result = await client.query(`SELECT id, checksum FROM ${MIGRATIONS_TABLE}`);
  const map = new Map<string, string>();
  for (const row of result.rows as Array<{ id: string; checksum: string }>) {
    map.set(row.id, row.checksum);
  }
  return map;
}

async function applyMigration(client: PgClientLike, migration: Migration): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(migration.sql);
    await client.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (id, checksum) VALUES ($1, $2)`,
      [migration.id, migration.checksum]
    );
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error; ROLLBACK failure is less useful.
    }
    throw err;
  }
}
