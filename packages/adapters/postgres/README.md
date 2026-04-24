# @loop-engine/adapter-postgres

[![npm](https://img.shields.io/npm/v/@loop-engine/adapter-postgres.svg)](https://www.npmjs.com/package/@loop-engine/adapter-postgres)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

PostgreSQL storage adapter for Loop Engine - persist loop state and transitions to Postgres.

## Install

```bash
npm install @loop-engine/adapter-postgres @loop-engine/sdk pg
```

## Quick Start

```ts
import { createLoopSystem } from "@loop-engine/sdk";
import {
  createPool,
  postgresStore,
  runMigrations
} from "@loop-engine/adapter-postgres";

const pool = createPool({ connectionString: process.env.DATABASE_URL });
await runMigrations(pool);

const { engine } = await createLoopSystem({
  loops: [loopDefinition],
  store: postgresStore(pool)
});
```

`createPool(...)` applies loop-engine-opinionated defaults; see the
"Pool configuration" section below. Consumers who want full control can
still `new Pool(...)` themselves and pass the result to
`postgresStore(pool)`.

## Schema migrations

The adapter ships versioned, idempotent SQL migrations and a small custom
runner. `createSchema(pool)` is a convenience that applies every pending
migration; `runMigrations(pool)` is the lower-level API that returns
structured information about which migrations were newly applied vs.
already recorded.

```ts
import { Pool } from "pg";
import { runMigrations } from "@loop-engine/adapter-postgres";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const result = await runMigrations(pool);
console.log(result);
// { applied: ["001_schema_migrations", "002_loop_instances", "003_loop_transitions"],
//   skipped: [] }
```

Key properties:

- **Idempotent**: calling `runMigrations` twice on the same database is a
  no-op (all migrations returned under `skipped`).
- **Transactional**: each migration applies inside its own transaction;
  a crash mid-migration leaves the database unchanged and the next run
  retries cleanly.
- **Concurrent-safe**: a Postgres advisory lock serializes concurrent
  callers, so two processes starting up simultaneously will not race
  into a duplicate-key error.
- **Drift-protected**: migrations are content-hashed with SHA-256; the
  runner refuses to proceed if an already-recorded migration's SQL has
  been edited on disk. To change schema, add a new migration file with
  a later numeric prefix.

Migrations are read from `dist/migrations/sql/` at runtime. The adapter
currently ships three:

- `001_schema_migrations.sql` — the `schema_migrations` tracking table
  used by the runner itself.
- `002_loop_instances.sql` — one row per loop aggregate; upserted by
  `LoopStore.saveInstance`.
- `003_loop_transitions.sql` — append-only transition history.

Supported Postgres versions: the adapter is tested against 15 and 16
and is documented to support 13+.

## Pool configuration

`createPool(options?)` is a thin wrapper around `pg.Pool` that applies
four opinionated defaults. All `pg.PoolConfig` fields pass through
unchanged, plus a first-class `statement_timeout` knob.

```ts
import { createPool, DEFAULT_POOL_OPTIONS } from "@loop-engine/adapter-postgres";

// Defaults:
// {
//   max: 10,
//   idleTimeoutMillis: 30_000,
//   connectionTimeoutMillis: 5_000,
//   statement_timeout: 30_000
// }
console.log(DEFAULT_POOL_OPTIONS);

// Typical usage:
const pool = createPool({
  connectionString: process.env.DATABASE_URL
});

// Override defaults:
const biggerPool = createPool({
  connectionString: process.env.DATABASE_URL,
  max: 25,
  statement_timeout: 5_000,
  options: "-c search_path=app_schema"
});
```

Rationale per default:

- **`max: 10`** — suitable for a single app instance against a standard
  Postgres deployment. Raise this in coordination with the server's
  `max_connections` when scaling horizontally.
- **`idleTimeoutMillis: 30_000`** — 30 seconds balances connection
  reuse under burst traffic against reclaiming slots during lulls.
- **`connectionTimeoutMillis: 5_000`** — 5 seconds is where pool
  exhaustion should fail loudly instead of silently accumulating
  request latency.
- **`statement_timeout: 30_000`** — caps worst-case query latency;
  runaway queries are canceled server-side rather than holding a
  connection hostage. Wired via the libpq `options` connection
  parameter (`-c statement_timeout=N`), so it applies at connection
  init — no per-query `SET` round-trip.

A consumer-supplied `options` string (e.g., `-c search_path=...`) is
preserved and the `statement_timeout` clause is appended alongside it.

## Transactions

`postgresStore(pool)` returns a `PostgresStore` — a `LoopStore` plus a
`withTransaction(fn)` method for atomically sequencing multiple
LoopStore operations against a single pg-acquired client.

```ts
import { postgresStore } from "@loop-engine/adapter-postgres";

const store = postgresStore(pool);

await store.withTransaction(async (tx) => {
  await tx.saveInstance(updatedInstance);
  await tx.saveTransitionRecord(transitionRecord);
});
```

The callback receives a `TransactionClient` with the same five
`LoopStore` methods, each routed through the transactional client.
Semantics:

- **Commit on success**: `fn` resolves → `COMMIT` → changes persist.
- **Rollback on error**: `fn` rejects → `ROLLBACK` → changes discarded
  → original error propagates unchanged.
- **Isolation**: Postgres's default `READ COMMITTED` applies — writes
  inside `fn` are invisible to reads on the outer pool until `COMMIT`.
- **Return-value propagation**: `fn`'s return value is the
  `withTransaction` return value.
- **Nesting via the outer store is independent**: calling
  `store.withTransaction(...)` inside another `store.withTransaction`
  acquires a second client and runs in its own transaction. To extend
  atomicity across nested scopes, pass the outer `tx` to the inner
  operation and call its LoopStore methods instead.

`TransactionClient` is intentionally narrow — it exposes LoopStore
methods only, with no raw `pg.PoolClient` escape hatch. Consumers
needing LISTEN/NOTIFY or other non-LoopStore Postgres operations should
manage their own `pg.Pool` alongside the adapter's.

## Documentation link

https://loopengine.io/docs/integrations/postgres

## License

Apache-2.0 © Better Data, Inc.
