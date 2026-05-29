# Loop Engine — OSS self-host example (RT-23)

Minimal **HTTP-only** client that proves Loop Engine can be consumed as an OSS
runtime product without importing monorepo internals.

## What it does

1. Checks registry health + catalog (`scm.replenishment`)
2. Checks runtime metadata (`/api/v1/metadata/connections`)
3. **Creates** a loop instance (`POST /api/v1/loops`)
4. **Starts** it (`POST /api/v1/loops/{id}/start`)
5. **Transitions** with signal `scm.replenishment.close.v1` (best-effort)
6. **Reads** history + evidence for the run
7. **Cancels** the instance (best-effort)

No `@loop-engine/*` npm dependencies in this example — only Node 20+ `fetch`.

## Prerequisites

From a **bd-forge-main** clone (or `loopengine/loop-engine` after RT-23 parity sync):

| Requirement | Notes |
|-------------|-------|
| Docker + compose | See [deploy/compose/README.md](../../deploy/compose/README.md) |
| Node 20+ | For this example script only |
| Free ports | 3011 / 3012 / 3020 (defaults) |

## Quickstart

```bash
# 1. From repo root — start the self-host stack (first boot: 3–8 min)
cp deploy/compose/.env.compose.example deploy/compose/.env.compose
make self-host-up

# 2. Seed API key + demo run (required for write auth + Studio dual-surface)
make seed

# 3. Run the example
cd examples/loop-engine-self-host
node run.mjs
```

**Order matters:** `make seed` must run before `node run.mjs`. Without seed, create returns
`500 Auth lookup failed` (DB auth mode, no API key row). With seed but invalid registry
catalog definitions, create returns `404 Loop definition not found` — fixed in RT-23
registry seed shape (SDK-valid states/transitions).

Optional — seed the Studio dual-surface demo run:

```bash
make self-host-seed
open http://localhost:3020/runs/self-host-demo-run-1/dual-surface
```

## Environment

| Variable | Default |
|----------|---------|
| `REGISTRY_URL` | `http://localhost:3011` |
| `LOOP_ENGINE_URL` | `http://localhost:3012` |
| `STUDIO_URL` | `http://localhost:3020` |
| `LOOP_ENGINE_API_KEY` | `le_5e1f0057de51f057de51f057de51f001` |
| `LOOP_ID` | `scm.replenishment` |

## Production images (GHCR)

Instead of dev-mode compose, pull RT-22 images — see
[docs/loopengine/self-host.md §Going to production](../../docs/loopengine/self-host.md#going-to-production).

Point the same env vars at your running containers.

## Package import validation (monorepo dev)

Validates packed `@loop-engine/*` tarballs import correctly (pre-RT-24 publish gate):

```bash
# from repo root
bash scripts/oss/validate-package-imports.sh

# or from this directory
npm run validate-imports
```

Also: `make runtime-publish-dry-run` (9 packages).

## Further reading

- [Self-host quickstart](../../docs/loopengine/self-host.md)
- [RT-23 parity checklist](../../docs/internal/sprints/RT-23-parity-checklist.md)
- [RT-23 close report](../../docs/internal/sprints/RT-23-close-report.md)
