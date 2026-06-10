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
