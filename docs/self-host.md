# Loop Engine — self-host quickstart

Run a complete Loop Engine stack — catalog, runtime API, Studio, and a seeded
demo run — locally with `docker compose up`. Nothing leaves your machine.

> This is the source copy for the `loopengine.io/docs/self-host` MVP page.
> The same content lives in [`deploy/compose/README.md`](../../deploy/compose/README.md)
> for operators.

## What you get

| Service | URL |
|---------|-----|
| Studio | http://localhost:3020 |
| Runtime API | http://localhost:3012 |
| Loop catalog | http://localhost:3011 |
| Postgres | localhost:5435 |

After seeding, the **Dual-surface** tab in Studio shows real
`integration.google_sheets` and `channel.slack` evidence on the demo run —
the same surface that ships in the hosted cloud, driven entirely from local
Postgres trace rows.

## Prerequisites

- Docker 24+ with the `compose` plugin (`docker compose version` returns v2+)
- ~6 GB free disk, ~4 GB free RAM
- Free ports 5435 / 3011 / 3012 / 3020 (overridable)

## Quickstart

```bash
git clone https://github.com/betterdataco/bd-forge-main.git
cd bd-forge-main

# Or the public OSS mirror (synced from bd-forge-main via RT-23):
# git clone https://github.com/loopengine/loop-engine.git && cd loop-engine

cp deploy/compose/.env.compose.example deploy/compose/.env.compose
docker compose -f deploy/compose/docker-compose.yml \
  --env-file deploy/compose/.env.compose up
```

First boot installs dependencies and runs Prisma migrations — 3–8 minutes on
a clean machine. Subsequent boots are under 30 seconds.

In a second shell, seed the demo run and verify:

```bash
docker compose -f deploy/compose/docker-compose.yml exec loop-engine-runtime \
  pnpm exec tsx scripts/self-host/seed-demo-run.ts

bash scripts/self-host/verify-quickstart.sh
```

Open http://localhost:3020/runs/self-host-demo-run-1/dual-surface.

### Runnable OSS example (RT-23)

After the stack is up, exercise the write API from a standalone HTTP client:

```bash
cd examples/loop-engine-self-host
node run.mjs
```

See [examples/loop-engine-self-host/README.md](../../examples/loop-engine-self-host/README.md).

## Architecture (self-host MVP, RT-20b)

```text
        ┌──────────────────────────────────┐
        │            you                    │
        └────┬─────────────────────┬────────┘
             │ Studio :3020         │ API :3012
             ▼                      ▼
      ┌──────────────┐      ┌─────────────────────┐
      │ studio        │      │ loop-engine-runtime  │
      │ (HTTP mode)   │─────▶│ (apps/loop-engine-    │
      └──────────────┘      │  runtime, OSS only)   │
                            └─┬──────────────┬─────┘
                              │              │
                       :3011 │              │ :5432
                       ┌─────▼──────┐ ┌─────▼─────┐
                       │ registry-  │ │ postgres   │
                       │ loop       │ │ (loops DB) │
                       │ (memory)   │ └───────────┘
                       └────────────┘
```

`loop-engine-runtime` is the OSS self-host runtime added by RT-20b. It
backs only the RT-01 frozen v1 surface and depends on
`@loop-engine/runtime-db`, `@loop-engine/runtime-core`, and
`@loop-engine/runtime-routes` — no proprietary monorepo packages. The
cloud `apps/hosted-loops` app is intentionally **not** part of this stack;
it stays cloud-first and keeps Slack/Google OAuth + billing.

## Authenticate with the demo API key

The seed creates one API key: `le_5e1f0057de51f057de51f057de51f001`
(hex-valid `le_*` token, validated by `@loop-engine/auth-iface`).

```bash
curl -H "Authorization: Bearer le_5e1f0057de51f057de51f057de51f001" \
  http://localhost:3012/api/v1/runs/self-host-demo-run-1/evidence | jq .
```

Studio is pre-configured with this key via `LOOP_ENGINE_API_KEY` in the
compose file — no further setup required.

### ⚠️ Rotate the demo key before any real use

The default key is **publicly visible in this repo and in the seed script**.
It exists only so the compose quickstart works without manual setup. Before
exposing the runtime to anyone other than your own laptop you MUST:

1. Generate a new hex `le_*` token (16 random bytes, hex-encoded):
   ```bash
   echo "le_$(openssl rand -hex 16)"
   ```
2. Insert a fresh row into `LoopEngineApiKey` (the OSS runtime hashes the
   token via SHA-256 and compares with constant-time semantics):
   ```bash
   pnpm tsx scripts/self-host/rotate-api-key.ts \
     --tenant self-host-tenant \
     --token le_<your_new_token>
   ```
   (Or use `psql` directly; see `scripts/self-host/rotate-api-key.ts` for the
   exact SQL it runs.)
3. Update `LOOP_ENGINE_API_KEY` in `deploy/compose/.env.compose` and restart
   the `loop-engine-runtime` + `studio` services.
4. Delete the demo row from `LoopEngineApiKey` once your new key works (the
   24-hour rotation grace window will keep the old token live until you do).

## What runs locally

- Loop catalog + version resolution (`/v0/loops`, `/v0/resolve`)
- RT-05 audit reads — history, evidence, timeline, replay summary
  (`/api/v1/runs/{runId}/...`)
- RT-11 metadata catalog (`/api/v1/metadata/connections`)
- **Live loop writes** — create, start, transition, cancel
  (`POST /api/v1/loops`, `/api/v1/loops/{id}/{start,transition,cancel}`)
- Studio Runs, Evidence, Timeline, Replay, Guards, Actors, **Dual-surface** tabs
- API-key auth (`le_*` Bearer) validated against `@loop-engine/runtime-db`

When `LOOP_ENGINE_REGISTRY_URL` is set (compose default), loop definitions
load from registry-loop's v0 HTTP API (`GET /v0/loops/*`). Local
`LoopDefinition` Postgres rows remain the fallback for custom operator-seeded
loops.

### Write API examples

Create a loop instance (requires a loop id present in the registry or local
`LoopDefinition` table — compose auto-seeds `scm.replenishment` in
registry-loop):

```bash
curl -sS -X POST http://localhost:3012/api/v1/loops \
  -H "Authorization: Bearer le_5e1f0057de51f057de51f057de51f001" \
  -H "Content-Type: application/json" \
  -d '{"loopId":"scm.replenishment","payload":{"sku":"ABC-123"}}' | jq .
```

Start, transition, and cancel use the `aggregateId` returned from create:

```bash
AGG=<aggregateId-from-create>

curl -sS -X POST "http://localhost:3012/api/v1/loops/${AGG}/start" \
  -H "Authorization: Bearer le_5e1f0057de51f057de51f057de51f001" | jq .

curl -sS -X POST "http://localhost:3012/api/v1/loops/${AGG}/transition" \
  -H "Authorization: Bearer le_5e1f0057de51f057de51f057de51f001" \
  -H "Content-Type: application/json" \
  -d '{"signalId":"scm.replenishment.close.v1","actor":{"id":"user:demo","type":"human"}}' | jq .

curl -sS -X POST "http://localhost:3012/api/v1/loops/${AGG}/cancel" \
  -H "Authorization: Bearer le_5e1f0057de51f057de51f057de51f001" | jq .
```

Idempotent create replays return `200` with `"idempotent": true` when the same
`idempotencyKey` is supplied twice.

## What requires the hosted cloud

These intentionally do not run in self-host because they require external
OAuth, hosted infrastructure, or proprietary code paths:

- Slack OAuth install + interactive approval (`/connectors/slack/...`)
- Google Docs / Sheets OAuth + apply (`/connectors/google/...`,
  `/google/sheets/apply`)
- Multi-tenant entitlements + billing
- Tenant install overlay + connector settings UI

You can still **see** Slack and Google evidence in Studio's Dual-surface tab —
seed any `LoopEvent` row with `evidence.channel` (Slack) or
`evidence.integration` (Docs/Sheets) following the shapes in
[the dual-surface examples](./examples/).

## Resetting

```bash
docker compose -f deploy/compose/docker-compose.yml down -v
```

Removes Postgres data + `node_modules` cache. Next `up` is a full clean boot.

## Troubleshooting

See [`deploy/compose/README.md#troubleshooting`](../../deploy/compose/README.md#troubleshooting)
for port conflicts, slow first boot, Prisma migrate retries, and total reset.

## Going to production

Self-host MVP runs each service in `pnpm dev` mode under a volume-mounted
repo — suitable for local exploration, demos, and CI smoke tests.

### Production images (GHCR)

RT-22 ships standalone Docker images for all three self-host apps. Images
build on `linux/amd64` and publish to GitHub Container Registry on `v*` tags
(via `.github/workflows/loop-engine-images.yml`):

| Image | GHCR name | Port |
|-------|-----------|------|
| Runtime | `ghcr.io/betterdataco/loop-engine-runtime` | 3012 |
| Registry | `ghcr.io/betterdataco/registry-loop` | 3011 |
| Studio | `ghcr.io/betterdataco/studio-app` | 3020 |

**Tag conventions:**

| Tag | When |
|-----|------|
| `sha-<short>` | Every release build |
| `1.0.0-rc.0` (semver) | `v1.0.0-rc.0` git tag |
| `latest` | GA only (`v1.0.0`) — **not** on RC tags |

**Pull and run (runtime smoke — no Postgres required):**

```bash
docker login ghcr.io   # read:packages token or GITHUB_TOKEN with packages:read
docker pull ghcr.io/betterdataco/loop-engine-runtime:1.0.0-rc.0

docker run --rm -p 3012:3012 ghcr.io/betterdataco/loop-engine-runtime:1.0.0-rc.0
curl -fsS http://localhost:3012/api/v1/metadata/connections | jq .
```

**Full stack with Postgres** (registry + runtime + studio):

```bash
# Postgres (example)
docker run -d --name loops-postgres \
  -e POSTGRES_DB=loops -e POSTGRES_USER=loops -e POSTGRES_PASSWORD=loops \
  -p 5435:5432 postgres:16-alpine

# Registry (memory catalog default)
docker run -d --name registry-loop -p 3011:3011 \
  ghcr.io/betterdataco/registry-loop:1.0.0-rc.0

# Runtime + schema push
docker run -d --name loop-engine-runtime -p 3012:3012 \
  -e LOOP_ENGINE_DATABASE_URL=postgresql://loops:loops@host.docker.internal:5435/loops \
  -e LOOP_ENGINE_DB_AUTO_PUSH=1 \
  ghcr.io/betterdataco/loop-engine-runtime:1.0.0-rc.0

# Seed demo run (from repo checkout — production images do not bundle the seeder)
LOOP_ENGINE_DATABASE_URL=postgresql://loops:loops@localhost:5435/loops \
  pnpm exec tsx scripts/self-host/seed-demo-run.ts

# Studio (HTTP mode)
docker run -d --name studio -p 3020:3020 \
  -e STUDIO_PROVIDER=http \
  -e LOOP_ENGINE_URL=http://host.docker.internal:3012 \
  -e LOOP_ENGINE_API_KEY=le_5e1f0057de51f057de51f057de51f001 \
  ghcr.io/betterdataco/studio-app:1.0.0-rc.0
```

Local image build/smoke (no GHCR):

```bash
make runtime-image-smoke
make registry-image-smoke
make studio-image-smoke
```

### Still operator-owned for production

- Real JWT signer + secret rotation
- Managed Postgres with backups
- Studio behind your own auth proxy
- Observability (logs, metrics)

The hosted Better Data cloud handles all of this plus the cloud-only features
above. The self-host compose is intentionally narrow: prove the runtime
contract works locally; production images remove the bind-mount dev dependency.

## Further reading

- [Slack decision channel](./examples/slack-decision-channel.md)
- [Google Docs approval](./examples/google-doc-approval.md)
- [Google Sheets staged edit](./examples/google-sheets-staged-edit.md)
