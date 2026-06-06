# Loop Engine build-portability scan — evidenced-READY (post-seam)

> **Status:** **READY.** This is the re-run the reconciliation note pointed to — the portability scan
> against the **merged, post-seam** ref. It supersedes `portability-scan-reconciliation.md` (which
> described the pre-seam state + the cure). This artifact is the one to keep for the OSS
> build-portability gate.

## Ref under scan

- Repo: `loopengine/loop-engine` (canonical clone)
- Merged ref: **`4a2eb8d`** — `extraction/oss-seam` fast-forwarded to `main` (seam build-out
  `2e8b299` → config swap `2547c83` → strictness `97bd271` → reconciliation note `1a0afe3`), then the
  landed `@loop-engine/loop-status-client` (`4a2eb8d`).
- Method: **fresh isolated clone** (separate from the `betterdata-platform/` workspace), clean
  `pnpm install`, scan + build. The double clone was collapsed to this ref (`betterdata-oss/loop-engine`
  hard-reset to `origin/main`), so there is a single source of truth.

## Axis 1 — leak boundary (no shared monorepo config)

| Check | Result |
| --- | --- |
| `@repo/*` dependency in any `packages/**` or `apps/**` manifest | **none** |
| any `tsconfig*.json` extending an `@repo/*` base | **none** (the 5 cured packages extend the local `tsconfig.base.json`) |

The pre-seam scan's five blockers (5 packages on `@repo/typescript-config`) are gone — cured by
`2547c83` (Option B local base) + `97bd271` (strictness). The newly landed client was authored against
the same local base and conformed to `exactOptionalPropertyTypes` on landing, so it adds no regression.

## Axis 2 — build portability (standalone, `@repo` absent)

| Check | Result |
| --- | --- |
| `@repo/*` in the committed `pnpm-lock.yaml` | **absent** |
| `@repo/*` in the isolated clone's `node_modules` after `pnpm install` | **absent** |
| `@loop-engine/*` workspace entries resolved | 134 |
| isolated build of the client dependency chain (`core → events → loop-status-client`) | **success** (esm + cjs + dts each) |
| `@loop-engine/loop-status-client` tests in the isolated clone | **8/8 pass** |
| `validate:publish` (`check-no-workspace-refs`) — packed manifests free of `workspace:` | **green**; client pins `@loop-engine/events` to `1.0.0-rc.0` |

## Verdict

**READY for the OSS build-portability gate.** Both axes pass on the post-seam ref, including the new
distribution-level client. Remaining OSS-track items are release-side, not portability:

1. The client's version decision (join the `1.0.0-rc.0` line vs. carry its own `0.1.0`) + changeset.
2. The public `changeset publish` with provenance (PUBLISH-GATE-01 sign-offs; visibility condition
   **inverts** here — confirm intended **public** on npmjs for `@loop-engine/*`).

## Known, out-of-scope reds (not portability blockers)

- `check-boundary` `apache-headers` rule flags pre-existing test files (runtime-core, runtime-routes,
  studio-client, studio-ui) that lack the SPDX header — inherited from the seam build-out, tracked
  separately. The landed client carries the header on every file (src + test).
