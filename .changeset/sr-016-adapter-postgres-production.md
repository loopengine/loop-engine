---
"@loop-engine/core": major
"@loop-engine/runtime": major
"@loop-engine/sdk": major
"@loop-engine/actors": major
"@loop-engine/guards": major
"@loop-engine/loop-definition": major
"@loop-engine/events": major
"@loop-engine/signals": major
"@loop-engine/observability": major
"@loop-engine/registry-client": major
"@loop-engine/ui-devtools": major
"@loop-engine/adapter-memory": major
"@loop-engine/adapter-vercel-ai": major
"@loop-engine/adapter-perplexity": major
"@loop-engine/adapter-anthropic": major
"@loop-engine/adapter-openai": major
"@loop-engine/adapter-gemini": major
"@loop-engine/adapter-grok": major
"@loop-engine/adapter-http": major
"@loop-engine/adapter-openclaw": major
"@loop-engine/adapter-pagerduty": major
"@loop-engine/adapter-commerce-gateway": major
---
## SR-016 · D-12 · `@loop-engine/adapter-postgres` production-grade

**Packages bumped:** `@loop-engine/adapter-postgres` (minor; `0.1.6` → `0.2.0`).

**Status.** Closed. Phase A.5 advances (Postgres portion complete; Kafka `@experimental` companion ships separately as SR-017).

**Class.** Class 2 (additive). No pre-existing public surface is removed or changed in shape; every previously exported symbol (`postgresStore`, `createSchema`, `PgClientLike`, `PgPoolLike`) keeps its signature. `PgClientLike` widens additively by adding optional `on?` / `off?` methods; callers whose client values lack those methods remain compatible via runtime presence-guarding.

**Rationale.** D-12 → C resolved `adapter-postgres` as the production-grade storage-adapter target for `1.0.0-rc.0` (paired with Kafka `@experimental` for event streaming — see SR-017). At SR-016 entry the package shipped as a stub (`0.1.6` with `postgresStore` / `createSchema` present but no migration runner, no transaction support, no pool configuration, no error classification, no index tuning, and — critically — no integration-test coverage against real Postgres). SR-016's seven sub-commits brought the package to production grade: versioned migrations, transactional helper with indeterminacy-safe error handling, opinionated pool factory with `statement_timeout` wiring, typed error classification with connection-loss semantics, and query-plan verification for the hot `listOpenInstances` path. 64 → 70 integration tests against both pg 15 and pg 16 via `testcontainers`.

**Sub-commit sequence.**

1. **SR-016.1** (`63f3042`) — integration-test infrastructure: `testcontainers` helper with Docker-availability assertion, matrix over `postgres:15-alpine` / `postgres:16-alpine`, initial smoke test proving `createSchema` runs end-to-end. Fail-loud discipline established (no mock-Postgres fallback).
2. **SR-016.2** — versioned migration runner: `runMigrations(pool)` / `loadMigrations()` with idempotency (tracked via `schema_migrations` table), transactional safety (each migration inside its own transaction), advisory-lock serialization (concurrent callers don't race on duplicate-key), and SHA-256 checksum drift detection (editing an applied migration is rejected at the next run). C-14 full-stream scan caught a `tsup` d.ts build failure (unused `@ts-expect-error`) during development — the calibration discipline's first prospective hit.
3. **SR-016.3** — `withTransaction(fn)` helper: `PostgresStore extends LoopStore` gains the method, `TransactionClient = LoopStore` type exported. Factoring via `buildLoopStoreAgainst(querier)` ensures pool-backed and transaction-backed stores share method bodies. No raw-`pg.PoolClient` escape hatch (provider-specific concerns stay in provider-specific factories per PB-EX-02 Option A). Surfaced **SF-SR016.3-1**: pre-existing timestamp-deserialization round-trip bug (`new Date(asString(...))` → `.toISOString()` throwing on `Date`-valued columns), resolved in-SR via `asIsoString` helper.
4. **SR-016.4** — pool configuration: `createPool(options)` / `DEFAULT_POOL_OPTIONS` / `PoolOptions`. Defaults: `max: 10`, `idleTimeoutMillis: 30_000`, `connectionTimeoutMillis: 5_000`, `statement_timeout: 30_000`. `statement_timeout` wired via libpq `options` connection parameter (`-c statement_timeout=N`) so it applies at connection init with no per-query `SET` round-trip; consumer-supplied `options` (e.g., `-c search_path=...`) preserved. Exhaust-and-recover test proves the pool's max-connection ceiling and recovery semantics. `pg` declared as `peerDependency` per generic rule's vendor-SDK discipline.
5. **SR-016.5** — error classification: `PostgresStoreError` base (with `.kind: "transient" | "permanent" | "unknown"` discriminant), `TransactionIntegrityError` subclass (always `kind: "transient"`), `classifyError(err)` / `isTransientError(err)` predicates. Narrow transient allowlist: `40P01`, `57P01`, `57P02`, `57P03` plus Node connection-error codes (`ECONNRESET`, `ECONNREFUSED`, etc.) and a `connection terminated` message regex. Constraint violations pass through as raw `pg.DatabaseError` (no per-SQLSTATE typed errors). Mid-transaction connection loss wraps as `TransactionIntegrityError` with cause preserved — the "indeterminacy rule" — so consumers can distinguish "transaction definitely failed, retry safe" from "transaction outcome unknown, caller must handle." Surfaced **SF-SR016.5-1**: pre-existing unhandled asynchronous `pg` client `'error'` event when a backend is terminated between queries, resolved in-SR via no-op handler installed in `withTransaction` for the transaction's duration with presence-guarded `client.on` / `client.off` for test-double compatibility.
6. **SR-016.6** (`2579e16`) — index migration: `idx_loop_instances_loop_id_status` composite index on `(loop_id, status)` supporting the `listOpenInstances(loopId)` query path. EXPLAIN verification against ~10k seeded rows (×2 matrix images) asserts two first-class conditions on the plan tree: (a) the plan selects `idx_loop_instances_loop_id_status`, and (b) no `Seq Scan on loop_instances` appears anywhere in the tree. Plan format stable across pg 15 and pg 16.
7. **SR-016.7** (this row) — rollup: this changeset entry, `DESIGN.md` capturing six load-bearing decisions for future maintainers, `PASS_B_EXECUTION_LOG.md` SR-016 aggregate, `API_SURFACE_SPEC_DRAFT.md` surface update, and integration-test-before-publish policy landed in `.cursor/rules/loop-engine-packaging.md`.

**Load-bearing decisions recorded in `packages/adapters/postgres/DESIGN.md`.** Six decisions a future PR should not reshape without arguing against the recorded rationale:

1. The SF-SR016.3-1 and SF-SR016.5-1 shared root cause (pre-existing latent bugs in uncovered adapter code paths) and the integration-test-before-publish policy derived from it.
2. `statement_timeout` wiring via libpq `options` connection parameter (not per-query `SET`; not a pool-event handler).
3. The `withTransaction` no-op `'error'` handler requirement with presence-guarded `client.on` / `client.off` for test-double compatibility.
4. Module split pattern: `pool.ts`, `errors.ts`, `migrations/runner.ts`, plus `buildLoopStoreAgainst(querier)` factoring in `index.ts`.
5. Adapter-postgres module structure as a candidate family-level convention (to be promoted to `loop-engine-packaging.md` when a second production-grade adapter reaches similar complexity).
6. `withTransaction` indeterminacy rule: four-way case matrix keyed on "did the adapter end in a state where the transaction's terminal outcome is known?", with governing principle "only wrap an error in `TransactionIntegrityError` when the adapter genuinely cannot confirm a definite terminal state."

**Migration.** No consumer migration required for existing `postgresStore(pool)` / `createSchema(pool)` callers — both keep their signatures. Consumers who want to adopt the new surface:

```diff
  import {
    postgresStore,
-   createSchema
+   createPool,
+   runMigrations
  } from "@loop-engine/adapter-postgres";
  import { createLoopSystem } from "@loop-engine/sdk";

- const pool = new Pool({ connectionString: process.env.DATABASE_URL });
- await createSchema(pool);
+ const pool = createPool({ connectionString: process.env.DATABASE_URL });
+ const migrationResult = await runMigrations(pool);
+ // migrationResult.applied lists newly-applied; .skipped lists already-applied.

  const { engine } = await createLoopSystem({
    loops: [loopDefinition],
    store: postgresStore(pool)
  });
```

```diff
  // Opt into transactional sequencing:
+ const store = postgresStore(pool);
+ await store.withTransaction(async (tx) => {
+   await tx.saveInstance(updatedInstance);
+   await tx.saveTransitionRecord(transitionRecord);
+ });
  // The callback receives a TransactionClient (LoopStore-shaped).
  // COMMIT on success, ROLLBACK on thrown error. Connection loss
  // during COMMIT surfaces as TransactionIntegrityError (kind: transient).
```

```diff
  // Opt into error-classification for retry logic:
+ import {
+   classifyError,
+   isTransientError,
+   TransactionIntegrityError
+ } from "@loop-engine/adapter-postgres";
+
+ try {
+   await store.withTransaction(async (tx) => { /* ... */ });
+ } catch (err) {
+   if (err instanceof TransactionIntegrityError) {
+     // Indeterminate — transaction may or may not have committed.
+     // Caller must handle (retry with compensating logic, alert, etc.).
+   } else if (isTransientError(err)) {
+     // Safe to retry with a fresh connection.
+   } else {
+     // Permanent: propagate to caller.
+   }
+ }
```

**Out of scope for this row (intentionally).**

- Kafka `@experimental` companion: ships as SR-017 (small companion commit per the scheduling decision at SR-015 close).
- Non-transactional migration stream (for `CREATE INDEX CONCURRENTLY` on large existing tables): flagged in `004_idx_loop_instances_loop_id_status.sql`'s header comment. At RC this is acceptable — new deploys build indexes against empty tables; existing small deploys tolerate the brief lock. A future adapter release may add the stream.
- Per-SQLSTATE typed error classes (e.g., `UniqueViolationError`, `ForeignKeyViolationError`): deferred. Consumers branch on `pg.DatabaseError.code` directly, which is the standard `pg` ecosystem pattern. Revisit if consumer telemetry shows repeated per-code unwrapping.
- Connection-pool metrics (pool size, idle connections, wait times): consumers who need observability can consume the `pg.Pool` instance directly (`pool.totalCount`, `pool.idleCount`, etc.). First-party observability integration is a `1.1.0` / later concern.
- LISTEN/NOTIFY surface: consumers who need Postgres pub-sub alongside the store should manage their own `pg.Pool` (the adapter explicitly does not expose a raw `pg.PoolClient` escape hatch via `TransactionClient` — see Decision 6 rationale in `DESIGN.md`).

**Symbol diff against 0.1.6.**

Added to `@loop-engine/adapter-postgres` public surface:

- `function runMigrations(pool: PgPoolLike, options?: RunMigrationsOptions): Promise<MigrationRunResult>`
- `function loadMigrations(): Promise<readonly Migration[]>`
- `type Migration = { readonly id: string; readonly sql: string; readonly checksum: string }`
- `type MigrationRunResult = { readonly applied: string[]; readonly skipped: string[] }`
- `type RunMigrationsOptions` (currently `{}`; reserved for future per-run overrides)
- `function createPool(options?: PoolOptions): Pool`
- `const DEFAULT_POOL_OPTIONS: Readonly<{ max: number; idleTimeoutMillis: number; connectionTimeoutMillis: number; statement_timeout: number }>`
- `type PoolOptions = pg.PoolConfig & { statement_timeout?: number }`
- `class PostgresStoreError extends Error` (with `readonly kind: PostgresStoreErrorKind` discriminant)
- `class TransactionIntegrityError extends PostgresStoreError` (always `kind: "transient"`)
- `type PostgresStoreErrorKind = "transient" | "permanent" | "unknown"`
- `function classifyError(err: unknown): PostgresStoreErrorKind`
- `function isTransientError(err: unknown): boolean`
- `type TransactionClient = LoopStore`
- `interface PostgresStore extends LoopStore { withTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> }`
- `PgClientLike` widens additively: `on?` and `off?` optional methods for asynchronous `'error'` event handling.

Changed (additive, no consumer-visible break):

- `postgresStore(pool)` return type widens from `LoopStore` to `PostgresStore` (superset — every existing `LoopStore` consumer keeps working; consumers who opt into `withTransaction` gain the new method).

No removals.

**Verification (Phase A.7 sub-set).**

- `pnpm -C packages/adapters/postgres typecheck` → exit 0.
- `pnpm -C packages/adapters/postgres test` → 70/70 passed across 6 files (`pool.test.ts` 7, `migrations.test.ts` 7, `transactions.test.ts` 11, `errors.test.ts` 31, `indexes.test.ts` 6, `smoke.test.ts` 8).
- `pnpm -C packages/adapters/postgres build` → exit 0. C-14 full-stream scan shows only the two pre-existing calibrated warnings (`.npmrc` `NODE_AUTH_TOKEN`; tsup `types`-condition ordering). Both warnings predate SR-016 and are tracked as unchanged-state carry-forward.
- `pnpm -r typecheck` → exit 0.
- `pnpm -r build` → exit 0. Full-stream C-14 scan clean.
- C-10 symlink integrity → clean.

**Originator.** D-12 → C (Postgres production-grade, paired with Kafka `@experimental`), with sub-commit granularity per the SR-016 plan authored at Phase A.5 open. Policy-landing originator: the shared root cause between SF-SR016.3-1 and SF-SR016.5-1, which motivated the integration-test-before-publish rule now at `loop-engine-packaging.md` §"Pre-publish verification requirements."
