# @loop-engine/runtime-db

OSS-subset Prisma schema and client for the Loop Engine self-host runtime.

This package ships the minimum tables required to stand up the [RT-01 frozen v1 runtime surface](https://github.com/betterdataco/bd-forge-main/blob/main/docs/internal/sprints/RT-20-design.md) locally — without any hosted-cloud assumptions (no billing, no entitlements DB, no Slack/Google connection state, no governance audit tables).

## Tables

| Model | Purpose |
| --- | --- |
| `LoopInstance` | One row per loop submission (state + idempotency key) |
| `LoopEvent` | Append-only transition history per instance |
| `LoopDefinition` | Inline-mode loop catalog (registry-mode skips this) |
| `LoopTraceRecord` | Per-transition trace row powering RT-05 history/evidence/timeline reads |
| `LoopRunSummary` | Aggregated run metadata for list/compare APIs |
| `LoopEngineApiKey` | Self-host developer API keys (`le_` prefix, SHA-256 hashed) |

These mirror the canonical hosted schema in [`packages/database-loops/prisma/schema.prisma`](../../database-loops/prisma/schema.prisma). The script [`scripts/check-runtime-db-prefix.mjs`](../../../scripts/check-runtime-db-prefix.mjs) enforces drift-free parity: every OSS model + field must exist with an identical type in the hosted schema.

## Usage

```ts
import { PrismaClient } from "@loop-engine/runtime-db";

const db = new PrismaClient({
  datasources: { db: { url: process.env.LOOP_ENGINE_DATABASE_URL } },
});

const instance = await db.loopInstance.create({
  data: { loopId: "demo.echo", tenantId: "default", aggregateId: "...", currentState: "idle" },
});
```

## Migrations

```bash
LOOP_ENGINE_DATABASE_URL=postgresql://... pnpm db:migrate
```

For development against a fresh Postgres (e.g. the self-host compose stack), use `db:push`:

```bash
LOOP_ENGINE_DATABASE_URL=postgresql://... pnpm db:push
```

## License

Apache-2.0. See [LICENSE](./LICENSE).
