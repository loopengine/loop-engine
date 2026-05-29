# @loop-engine/runtime-core

OSS runtime primitives for the self-host Loop Engine runtime app.

This package owns the hosting-agnostic pieces that the OSS Next.js app (`apps/loop-engine-runtime`) wires together. It depends on:

- [`@loop-engine/runtime-db`](../loop-engine-runtime-db) — Prisma client for the OSS 6-model schema
- [`@loop-engine/auth-iface`](../loop-engine-auth-iface) — auth seam + bearer/API-key helpers
- [`@loop-engine/entitlements-iface`](../loop-engine-entitlements-iface) — entitlements seam + memory adapter
- [`@loop-engine/observability`](../observability) — `TraceStore` / `TraceRecord` contract, RT-05 read DTOs, timeline + metrics helpers

It **does NOT** depend on `@betterdata/database-loops`, `@repo/database`, `@repo/auth`, or any other proprietary package.

## What's inside

| Module | Purpose |
| --- | --- |
| `OssPostgresTraceStore` + `PrismaTraceRepository` | Postgres-backed `TraceStore` implementation, mirroring the hosted `PostgresTraceStore` but rooted on `@loop-engine/runtime-db`. |
| `buildRunDetailResponse` / `History` / `Evidence` / `Timeline` / `ReplaySummary` | RT-05 read response builders. Identical shape to the hosted helpers; consumed by `@loop-engine/runtime-routes`. |
| `DbAuthAdapter` | `AuthAdapter` impl that validates `le_*` API keys against `LoopEngineApiKey` (with 24h rotation grace). |
| `buildMetadataConnectionsResponse` | RT-11 static metadata catalog with `?category=` filter. Bundles `schemas/runtime-connections.json`. |
| `err401` … `err503` | Canonical error envelope factories matching the frozen contract. |
| `RuntimeContext` | Injection shape consumed by `@loop-engine/runtime-routes` factories. |

## License

Apache-2.0. See [LICENSE](./LICENSE).
