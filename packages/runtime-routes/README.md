# @loop-engine/runtime-routes

Route handler factories for the RT-01 frozen Loop Engine runtime API surface, consumed by the OSS self-host app [`apps/loop-engine-runtime`](../../../apps/loop-engine-runtime).

## What's inside

| Factory | Mounts |
| --- | --- |
| `createRunDetailHandler(ctx)` | `GET /api/v1/runs/{id}` |
| `createRunHistoryHandler(ctx)` | `GET /api/v1/runs/{id}/history` |
| `createRunEvidenceHandler(ctx)` | `GET /api/v1/runs/{id}/evidence` |
| `createRunTimelineHandler(ctx)` | `GET /api/v1/runs/{id}/timeline` |
| `createRunReplaySummaryHandler(ctx)` | `GET /api/v1/runs/{id}/replay-summary` |
| `createMetadataConnectionsHandler()` | `GET /api/v1/metadata/connections` |

Each factory takes the `RuntimeContext` exported from [`@loop-engine/runtime-core`](../loop-engine-runtime-core) (auth adapter, entitlements adapter, trace store, trace repository, `traceReadEnabled` flag) and returns a Web standard `(request, ctx) => Promise<Response>` handler. The OSS app re-exports each as `GET` from its Next.js Route Handler files.

Run-scoped routes go through `withPersistedRunRead`, which enforces the frozen RT-01 contract:

1. `LOOP_TRACE_ENABLED` gate (503 when disabled).
2. `AuthAdapter.authenticate` (401 on miss).
3. `assertRuntimeAllowed` on the entitlements snapshot (403 on tier 0).
4. In-process sliding-window rate limit per tenant (429 on overrun).
5. `traceRepository.getRunSummary` → 404 if missing.
6. Build response and serialize as JSON.

## Tests

```bash
pnpm --filter @loop-engine/runtime-routes test
```

Tests use `MemoryAuthAdapter`, `MemoryEntitlementsAdapter`, and an in-memory trace store/repository — no Postgres required.

## License

Apache-2.0. See [LICENSE](./LICENSE).
