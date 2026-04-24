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
import { Pool } from "pg";
import { createLoopSystem } from "@loop-engine/sdk";
import { createSchema, postgresStore } from "@loop-engine/adapter-postgres";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await createSchema(pool);

const { engine } = await createLoopSystem({
  loops: [loopDefinition],
  store: postgresStore(pool)
});
```

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
