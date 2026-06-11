# `@loop-engine/*` RC.1 release — enumerated publish plan

**Status: EXECUTED — 2026-06-10.** Bootstrap dispatch published the 9 first-publish names (token +
provenance); Trusted Publishers bound; `v1.0.0-rc.1` re-pointed to `9c5be4e` and the tag run
OIDC-published the remaining 7 and passed the clean-install verify. Post-release plan check:
**TOTAL TO PUBLISH = 0** — registry parity with `main` achieved. All 16 shipped as enumerated.

## Why this release exists

A stale-registry incident: the OSS seam merge landed new exports on `main`
(`@loop-engine/observability` gained `RUNTIME_API_CONTRACT_VERSION`, the trace/audit-read surface;
`@loop-engine/registry-client` gained the `v0` adapter) plus a family of brand-new packages — but
none of it was ever published. The registry's `1.0.0-rc.0` predates the seam, so
`@loop-engine/studio-client` (which imports `RUNTIME_API_CONTRACT_VERSION`) was broken against npm.

This release republishes the changed packages **and their full internal-dependency closure**, and
first-publishes every new seam package, so the registry matches `main`.

## Expected publish plan (bump-set ∪ never-published-set)

Computed by diffing each public package's manifest version against
`npm view <name> versions` on `registry.npmjs.org`. **16 packages will publish:**

### rc.1 bump closure (changed surface + transitive dependents)

| Package | Version | Reason |
| --- | --- | --- |
| `@loop-engine/observability` | `1.0.0-rc.1` | direct (seam trace/audit-read surface) |
| `@loop-engine/registry-client` | `1.0.0-rc.1` | direct (seam `v0` adapter) |
| `@loop-engine/sdk` | `1.0.0-rc.1` | depends on observability + registry-client |
| `@loop-engine/ui-devtools` | `1.0.0-rc.1` | depends on observability |
| `@loop-engine/runtime-core` | `1.0.0-rc.1` | depends on observability (also new — see below) |
| `@loop-engine/runtime-routes` | `1.0.0-rc.1` | depends on observability (also new — see below) |
| `@loop-engine/adapter-commerce-gateway` | `1.0.0-rc.1` | transitive (→ sdk) |
| `@loop-engine/adapter-gemini` | `1.0.0-rc.1` | transitive (→ sdk) |
| `@loop-engine/adapter-grok` | `1.0.0-rc.1` | transitive (→ sdk) |

### Never-published seam packages (first publish, at initial version)

| Package | Version | Note |
| --- | --- | --- |
| `@loop-engine/canonical-json` | `0.1.0` | new (relocated from `@betterdata/*` pre-publish — see Decisions) |
| `@loop-engine/auth-iface` | `1.0.0-rc.0` | new |
| `@loop-engine/entitlements-iface` | `1.0.0-rc.0` | new |
| `@loop-engine/runtime-db` | `1.0.0-rc.0` | new |
| `@loop-engine/runtime-core` | `1.0.0-rc.1` | new (also in bump closure) |
| `@loop-engine/runtime-routes` | `1.0.0-rc.1` | new (also in bump closure) |
| `@loop-engine/loop-status-client` | `0.1.0` | new — Boss Loops consumable surface |
| `@loop-engine/studio-client` | `0.1.0` | new (pinned to 0.1.0 — see Decisions) |
| `@loop-engine/studio-ui` | `0.1.0` | new (pinned to 0.1.0 — see Decisions) |

Union = 16 (`runtime-core`, `runtime-routes` appear in both sets).

## NOT publishing (closure proof)

Everything still at `1.0.0-rc.0` is already on npm and is correctly skipped:
`core`, `events`, `guards`, `signals`, `runtime`, `actors`, `loop-definition`, and adapters
`anthropic`, `http`, `memory`, `openai`, `openclaw`, `pagerduty`, `perplexity`, `vercel-ai`.

That none of these were bumped **is** the completeness proof: any package whose published artifact
must change because a workspace dependency changed was caught by the `updateInternalDependencies:
patch` cascade. The skip-set has no edge into the changed set at its publish-pinned ranges. In
particular `@loop-engine/events` stays `rc.0` (untouched by the seam), and `loop-status-client`'s
dependence on it is already satisfied on npm.

Ignored by changeset config (unchanged): `adapter-postgres` (`0.2.0`), `adapter-kafka` (`0.1.7`).
Private (never publish): `inspector`, `playground`.

## New names requiring npm Trusted-Publisher / scope setup

First-ever publishes — each needs a Trusted Publisher configured on npmjs before the tagged run can
push it (OIDC, no token): `auth-iface`, `entitlements-iface`, `runtime-db`, `runtime-core`,
`runtime-routes`, `loop-status-client`, `studio-client`, `studio-ui`, and `canonical-json`. All 16
publishing packages now bind under a single npm org (`@loop-engine`) for Trusted-Publisher setup —
no second-scope binding to maintain.

First-publish caveat (confirmed — npm/cli#8544): Trusted Publishing **cannot** create a package
that does not yet exist on the registry; the TP config requires an existing package record. The
bootstrap path is built into `rc-tag-release.yml` as the `token_bootstrap` dispatch input:

1. Add `NPM_TOKEN` repo secret (granular automation token: new-package create rights on
   `@loop-engine`, bypass-2FA).
2. Run the workflow manually from `main` with `token_bootstrap` CHECKED and `dry_run` UNCHECKED —
   publishes ONLY the 9 names above (token auth + provenance), skips the GitHub Release.
3. Bind Trusted Publishers for the 9 on npmjs (repo `loopengine/loop-engine`, workflow
   `rc-tag-release.yml`, environment left blank — it must match the workflow, which declares none).
4. Delete the `NPM_TOKEN` secret, prune the `BOOTSTRAP_PACKAGES` list, then push the tag — the
   normal OIDC publish ships the remaining 7 and skips the 9 already on the registry.

## Decisions baked into this prep

1. **`studio-client` / `studio-ui` pinned to `0.1.0`.** `changeset version`'s pre-mode cascade
   mechanically produced `0.1.1-rc.0` — a patch-prerelease of a version that never existed. A
   package's first registry entry should be its initial version; rc-line dependence is expressed in
   the dependency ranges, not the package's own version (same principle as `loop-status-client@0.1.0`
   depending on `events@1.0.0-rc.0`). All three new clients enter at `0.1.0`. Workspace resolution
   still lands their `observability` dep on `1.0.0-rc.1` at publish, so there is no cost.
2. **`observability` / `registry-client` bumped `patch`** to iterate within the `1.0.0` RC line
   (→ `rc.1`). The changes are additive, but the eventual stable `1.0.0` is governed by the consumed
   surface-reconciliation (`sr-*`) changesets; the `patch` here only advances the rc counter.
3. **`repository` metadata normalized to `loopengine/loop-engine`** before the tag. Five seam
   packages (`auth-iface`, `entitlements-iface`, `runtime-db`, `runtime-core`, `runtime-routes`)
   carried `repository.url`/`bugs.url` pointing at the proprietary monorepo
   (`betterdataco/bd-forge-main`) with directories that don't exist in this repo — a provenance
   validation failure waiting at publish (npm checks the manifest's `repository` against the
   attestation's source repo) and a leak of the monorepo's name into public OSS metadata. Four more
   (`canonical-json`, `studio-client`, `studio-ui`, `observability`) had no `repository` at all.
   All nine now carry `repository.url = loopengine/loop-engine` with correct `directory`, matching
   the rest of the family. Lockfile untouched (metadata only); `validate:publish` green.
4. **`canonical-json` relocated `@betterdata/*` → `@loop-engine/*`** before first publish. It ships
   from this repo, versions through this repo's changesets, and releases on this repo's tag — its
   scope should say so. `@betterdata` is a mixed proprietary/OSS scope (deepens classify-by-identity
   burden); `@loop-engine` is the unambiguous Boss Loops OSS distribution namespace. Done now because
   the package is unpublished: a pure in-repo find-replace (zero in-repo importers — the only
   `@betterdata/*` references in the tree are to the proprietary `@betterdata/database-loops`), no
   deprecation, no dual-publish. **No version-bump changeset** was added — that would reintroduce the
   phantom-version problem (Decision 1); the package first-publishes fresh at `@loop-engine/canonical-json@0.1.0`.
   Publish count is unchanged at 16 — one corrected name.

## Verification

- `pnpm check-boundary` → green across all six checks (apache-headers cleared; the two pre-existing
  `dependency-declarations` false-positives — a JSDoc self-reference and test-only devDeps — fixed by
  hardening the checker to skip `__tests__` and self-references, consistent with its core-neutrality
  carve-out).
- Plan computed by `npm view` diff (see above); re-run before tagging to confirm the actual
  `changeset publish` plan matches this list exactly.

Tag push is performed manually after this review.

---

## DATED STATE — Prompt 1.5 OSS publish verification (2026-06-10)

**Family/version:** `@loop-engine/*` rc.1 — 16/16 packages published on the public npm registry.

**Registry parity: PASS**
- Enumerated plan check re-run post-release: **TOTAL TO PUBLISH: 0**.
- Per-package `npm view` vs manifest diff across the full 16-package publish set: 16 OK, 0 diffs
  (rc.1 closure at `1.0.0-rc.1`; ifaces/runtime-db at `1.0.0-rc.0`; four clients at `0.1.0`).

**Clean consumer: PASS**
- Fresh external project (`/tmp/rc1-consumer`, outside the repo) installed
  `@loop-engine/sdk@1.0.0-rc.1`, `@loop-engine/observability@1.0.0-rc.1`,
  `@loop-engine/studio-client@0.1.0` from the public registry — zero workspace symlinks in the tree.
- Stale-proof symbol verified both module systems: CJS and **ESM named import** (the exact rc.0
  failure mode) of `RUNTIME_API_CONTRACT_VERSION` → `runtime-api-2026-05`; `studio-client` loads
  (11 exports); `sdk.createLoopSystem` callable.

**Provenance: PASS**
- `npm audit signatures` in the consumer project: 14 verified registry signatures, 13 verified
  attestations.
- Attestations present on BOTH publish paths: OIDC tag run (`sdk`, `observability`) and token
  bootstrap (`auth-iface`, `canonical-json`, `studio-client`) — the `NPM_CONFIG_PROVENANCE=true` +
  `id-token: write` bootstrap design held.
- CI publish confirmed from GitHub Actions: bootstrap dispatch `27287626502` (success, `580a8c5`),
  OIDC tag run `27288864301` (success, `9c5be4e`). No laptop publish.

**Credential hygiene: PASS (confirmed)**
- 9 first-ever names bootstrapped via the gated `token_bootstrap` dispatch; path retired —
  `BOOTSTRAP_PACKAGES` pruned with empty-list guard (`9c5be4e`).
- `NPM_TOKEN` repo secret **deleted** (verified: `gh secret list` empty).
- Trusted Publishers bound for the 9 (repo `loopengine/loop-engine`, workflow
  `rc-tag-release.yml`, environment blank) — user-performed 2026-06-10; mechanically provable at
  the next OIDC publish of any of the 9.
- npm-side tokens revoked — **confirmed 2026-06-10 09:57 PT** (account token page): bootstrap
  "Runbook Token", rc.0-era "automation", and expired "bttrdata" all deleted. **No standing
  long-lived token remains for the `@loop-engine` family** — TP-only publishing from here. One
  account token remains by deliberate choice (`betterdata-org-publish`, expires Jul 30) for the
  `@betterdata/*` npmjs pipeline (Signal Tags) — different family, out of this gate's scope.

**Tag integrity: PASS**
- Remote `refs/tags/v1.0.0-rc.1` (annotated `8a3c067`) dereferences to **`9c5be4e`**; the stale
  tag at `ffb0853` was deleted from the remote before re-tagging (single ref remains).
- GitHub Release `v1.0.0-rc.1` created 2026-06-10T16:01:24Z from the corrected tag, marked
  prerelease.

**Registered cleanup follow-ups (non-blocking — none affect the clean-consumer verification):**
- **LOOP-CLEANUP-01** — `runtime-core` test types (5 TS errors in 2 seam-era test files:
  `RuntimeIdentity` missing `role`/`source`; unbranded `StateId` strings) — owner: TBD — status: registered.
- **LOOP-CLEANUP-02** — `registry-client` contract-test spec path (resolves `../../../../..` to
  monorepo depth; `docs/specs/loop-registry-api-v0.md` exists only in bd-forge-main — vendor the
  spec + fix depth) — owner: TBD — status: registered.
- **LOOP-CLEANUP-03** — `runtime-db` empty test suite (`vitest run` exits 1 with no test files;
  `--passWithNoTests` or drop the script) — owner: TBD — status: registered.
- Note: these gate **Prompt 2's fresh-clone TEST criterion** (per the revised prompt set) and must
  clear before Boss Loops' hosted extraction, but do not block this publish gate.

**Gate result: PASS**
- Boss Loops OSS row flipped to **published-and-green (registry parity)** in the prompt-0-5
  scoreboard (bd-forge-main `d70e2203`).
- Prompt 2's OSS-publish precondition is **satisfied for this OSS family** (remaining Prompt 2
  gates — readiness steps 1–4, per-coupling severances, extraction order — tracked in the set).

## DATED STATE — Prompt 1.5 RE-RUN, import-graph-derived (2026-06-11)

**Why re-run:** the 2026-06-10 block's parity expected-set was derived from the rc.1
RELEASE BUMP-SET. That basis is **VOID** — it was blind to imported-but-never-released
packages, and three `@loop-engine/*`-named workspace packages reached Boss Loops' Prompt 2
doorstep under a false green (resolved by the package closure,
bd-forge-main `0fd19001` / `boss-loops-prompt-2-package-closure.md`). This block is the
corrected gate: the expected universe is derived from the **consuming hosted app's actual
import graph**, independently, not inherited from any upstream artifact.

**1. Registry parity — PASS (derived, not inherited).**
Universe = hosted-loops RUNTIME closure (fresh import scan of `apps/hosted-loops/{app,lib}`
+ transitive workspace members `database-loops`, `loop-state-sync-internal`,
`engine-baselines-internal`): `core@1.0.0-rc.0`, `runtime@1.0.0-rc.0`, `sdk@1.0.0-rc.1`,
`adapter-postgres@0.2.0`, `adapter-http@1.0.0-rc.0`, `observability@1.0.0-rc.1`,
`canonical-json@0.1.0` (transitive — surfaced only by the graph derivation); dev closure
adds `registry-client@1.0.0-rc.1`. Every member on the registry at a version **matching
this repo's `main`** (8/8 npm-view diff = MATCH). Post-closure, zero hosted imports
resolve to unpublished `@loop-engine/*` names. **TOTAL TO PUBLISH: 0.**

**2. Clean-consumer install — PASS.** Fresh external ESM project (`/tmp`, outside any
workspace), `npm install` of 10 family packages from the public registry, registry-resolved
closure (31 packages). All 10 import with non-empty export surfaces; staleness-proof
symbols present: `createLoopStatusClient` + `parseSseFrame` (the LOOP-STATE-01 seam
client) and `RUNTIME_API_CONTRACT_VERSION` (observability contract const). Exit 0.

**3. Provenance — PASS.** `dist.attestations` present for 10/10 checked specs (incl. both
rc.0-pinned and rc.1 members) — CI publish with `id-token: write`.

**4. Credential hygiene — PASS, one residue flagged.** `npm whoami` → E401: **no live
credential on the operator machine**; bootstrap tokens were revoked 2026-06-10 and no
token has been minted since. Residue: a **dead** `npm_…` token string remains in the
operator's `~/.npmrc` (rejected by the registry — that is the E401). Not a live
credential, does not fail the gate; flagged for deletion of the line.

**5. Tag integrity — PASS.** `v1.0.0-rc.1` → `9c5be4e`, ancestor of `origin/main`, local
and remote agree; single ref (the 2026-06-10 correction holds). Historical note:
`v1.0.0-rc.0` (`3f4d93e`) and `v0.2.0` (`4a45489`) are not ancestors of current `main`
because they predate the R3 hard-reset; they match the remote and the published artifacts
— not stale/moved tags.

**6. Cleanup registered — PASS.** LOOP-CLEANUP-01..03: **cleared 2026-06-10 (D2)**.
New registrations from the package closure (owners assigned, tracked in bd-forge-main's
0.5 board): C6/LOOP-ACTORS-01 (workspace `@loop-engine/actors` collision → CC closure
round); FAN-OUT-INVERSION (inlined CC fan-out mirror in hosted-loops → CC severance
track); CC `apps/scm` + Platform Admin `apps/admin` pre-existing typecheck debt
(registered against their own gates, not Boss Loops').

**Gate result: PASS — derived independently; the import-graph universe is the recorded
basis.** Boss Loops' OSS row reads published-and-green (registry parity, corrected basis);
Prompt 2's OSS-publish precondition is genuinely satisfied.
