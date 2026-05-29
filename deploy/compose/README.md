# Loop Engine — Self-host compose (RT-16 MVP, RT-17 polish, RT-20b OSS runtime)

Run the Loop Engine OSS stack locally with `docker compose up`. No Better Data
account, no proprietary entitlements DB, no Slack/Google OAuth required.

**RT-20b update:** The runtime API service is now `loop-engine-runtime`
(`apps/loop-engine-runtime`) — the OSS Next.js app introduced by the Option B
hosted/OSS split. The legacy `hosted-loops` service has been removed from this
compose file; `apps/hosted-loops` stays cloud-first and is no longer the
self-host target. `HOSTED_LOOPS_SELF_HOST` is no longer set anywhere in the
compose path.

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Docker Engine 24+ with the `compose` plugin | macOS: Docker Desktop. Linux: `docker compose version` must return v2+ (not the legacy `docker-compose` binary) |
| ~6 GB free disk | Postgres volume + `node_modules` volume + image cache |
| ~4 GB free RAM | First boot peaks during `pnpm install`; steady-state ~1 GB |
| Free ports | `5435`, `3011`, `3012`, `3020` — override via `.env.compose` if any are taken |

## Services

| Service | Port | Role |
|---------|------|------|
| `postgres` | 5435 | Loops data plane (`loops` DB) |
| `registry-loop` | 3011 | Loop catalog (`REGISTRY_REPOSITORY=memory`, auto-seeds 12 demo ids) |
| `loop-engine-runtime` | 3012 | OSS runtime API — mounts only RT-01 frozen routes against `@loop-engine/runtime-db` |
| `studio` | 3020 | OSS Studio shell (`STUDIO_PROVIDER=http`, points at `loop-engine-runtime`) |

## Quickstart (≤ 15 min from clean clone)

```bash
# 1. From the repo root:
cp deploy/compose/.env.compose.example deploy/compose/.env.compose

# 2. Bring up the stack (first run installs deps + builds — slow once):
docker compose -f deploy/compose/docker-compose.yml \
  --env-file deploy/compose/.env.compose up

# 3. In a second shell, seed the demo run + verify each service is responding:
docker compose -f deploy/compose/docker-compose.yml exec loop-engine-runtime \
  pnpm exec tsx scripts/self-host/seed-demo-run.ts

bash scripts/self-host/verify-quickstart.sh

# 4. Open Studio:
open http://localhost:3020/runs/self-host-demo-run-1/dual-surface
```

In Studio, the **Dual-surface** tab renders the seeded
`integration.google_sheets` (proposed value `1200`) and `channel.slack`
(decider `UDEMO`) evidence served from RT-05 trace reads.

## What the seed creates

Idempotent — safe to re-run.

- `LoopEngineApiKey` — plain key `le_5e1f0057de51f057de51f057de51f001` (hex-valid `le_*` token)
- `LoopInstance` for `dual-surface.spreadsheet-approval`
- `LoopRunSummary` aggregating the run
- **3 `LoopTraceRecord` rows** (RT-20b) — these power `/api/v1/runs/{id}/{history,evidence,timeline,replay-summary}` and carry the dual-surface evidence payloads
- 1 `LoopEvent` row for legacy `/api/v1/loops/{key}/events` back-compat

## Verify directly via the API

```bash
export API_KEY=le_5e1f0057de51f057de51f057de51f001
curl -s -H "Authorization: Bearer $API_KEY" \
  http://localhost:3012/api/v1/runs/self-host-demo-run-1/history | jq .
curl -s -H "Authorization: Bearer $API_KEY" \
  http://localhost:3012/api/v1/runs/self-host-demo-run-1/evidence | jq .
curl -s http://localhost:3012/api/v1/metadata/connections | jq '.connections[].id'
```

## Tear down

```bash
docker compose -f deploy/compose/docker-compose.yml down -v
```

`-v` wipes the Postgres volume **and** the cached `workspace-node-modules`
volume so the next `up` starts clean (subsequent `up` without `-v` is fast).

## Cloud-only footnote

The following intentionally do **not** run in self-host compose; they require
external OAuth or are hosted/cloud features. They live in `apps/hosted-loops`
(the cloud-first app, not started here):

- Slack OAuth + interactive routes (RT-12)
- Google Docs / Sheets OAuth + apply path (RT-13/14)
- Multi-tenant entitlements + billing
- Tenant install overlay
- Studio Connectors UI (deferred)

Dual-surface **evidence visibility** (RT-15) works end-to-end against seeded
trace rows.

## Limitations vs. Cloud

| Capability | Self-host | Cloud |
|------------|-----------|-------|
| Loop run reads (RT-05) | ✓ (seeded trace) | ✓ (live trace) |
| Dual-surface evidence panel (RT-15) | ✓ (seeded) | ✓ (live) |
| RT-11 metadata catalog | ✓ | ✓ |
| Slack approve / Google apply | ✗ | ✓ |
| Multi-tenant entitlements | tier-1 fixed (`MemoryEntitlementsAdapter`) | enforced via cloud DB |
| Metering / billing | ✗ | ✓ |
| Connector management UI | ✗ | ✗ (deferred) |
| Live loop transitions / write APIs | deferred (RT-20c) | ✓ |

## Troubleshooting

### First boot is slow / appears hung

Each service runs `pnpm install --frozen-lockfile` once on first boot, which
takes 3–8 minutes on a clean machine. Watch progress with:

```bash
docker compose -f deploy/compose/docker-compose.yml logs -f loop-engine-runtime
```

Subsequent boots reuse the `workspace-node-modules` volume and start in
under 30 seconds.

### Port already in use

If any of `5435`, `3011`, `3012`, `3020` are taken, override in `.env.compose`:

```bash
SELF_HOST_POSTGRES_PORT=5436
SELF_HOST_REGISTRY_PORT=3111
SELF_HOST_RUNTIME_PORT=3112
SELF_HOST_STUDIO_PORT=3120
```

Then re-bring up the stack.

### Prisma migrate fails

Postgres healthcheck should gate `loop-engine-runtime` startup. If migrate
still fails:

```bash
docker compose -f deploy/compose/docker-compose.yml ps
docker compose -f deploy/compose/docker-compose.yml logs postgres
# verify postgres reports "ready to accept connections"
```

Then restart the runtime only:

```bash
docker compose -f deploy/compose/docker-compose.yml restart loop-engine-runtime
```

### Studio shows mock data

Confirm Studio is in HTTP mode and pointing at the right backend:

```bash
docker compose -f deploy/compose/docker-compose.yml exec studio \
  printenv STUDIO_PROVIDER LOOP_ENGINE_URL LOOP_ENGINE_API_KEY
```

Expected:
- `STUDIO_PROVIDER=http`
- `LOOP_ENGINE_URL=http://loop-engine-runtime:3012`
- `LOOP_ENGINE_API_KEY=le_5e1f0057de51f057de51f057de51f001`

### Studio returns 401 on the seeded run

The API key wasn't seeded yet. Re-run:

```bash
docker compose -f deploy/compose/docker-compose.yml exec loop-engine-runtime \
  pnpm exec tsx scripts/self-host/seed-demo-run.ts
```

### Total reset

```bash
docker compose -f deploy/compose/docker-compose.yml down -v --rmi local
```

Wipes containers, volumes, and locally-built images. Next `up` is a full
cold start (~15 min).

## Production images (GHCR)

For operators who want pre-built containers instead of the dev-mode compose
stack, RT-22 publishes standalone images to GHCR on `v*` release tags:

| Image | GHCR | Local smoke |
|-------|------|-------------|
| `loop-engine-runtime` | `ghcr.io/betterdataco/loop-engine-runtime` | `make runtime-image-smoke` |
| `registry-loop` | `ghcr.io/betterdataco/registry-loop` | `make registry-image-smoke` |
| `studio-app` | `ghcr.io/betterdataco/studio-app` | `make studio-image-smoke` |

Build locally without GHCR:

```bash
make runtime-image-build
make registry-image-build
make studio-image-build
```

CI validates Dockerfiles on PR (build-only, no push). Push runs on `v*` tags
with tags `sha-<short>`, semver (e.g. `1.0.0-rc.0`), and `latest` on GA only.

See [docs/loopengine/self-host.md §Going to production](../../docs/loopengine/self-host.md#going-to-production)
for pull/run examples.

## Runnable example (RT-23)

HTTP-only client — no monorepo imports:

```bash
make self-host-up
cd examples/loop-engine-self-host && node run.mjs
```

See [examples/loop-engine-self-host/README.md](../../examples/loop-engine-self-host/README.md).

## Further reading

- Public docs source: `docs/loopengine/self-host.md`
- Close reports: `RT-16`, `RT-17`, `RT-20a`, `RT-20b`
- Hosted vs. OSS split TDD: `docs/internal/sprints/RT-20-design.md`
- Dual-surface examples: `docs/loopengine/examples/`
