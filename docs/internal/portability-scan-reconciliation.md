# Loop Engine build-portability scan — reconciliation note

> **Status:** **SUPERSEDED** by [`portability-scan-evidenced-ready.md`](./portability-scan-evidenced-ready.md)
> (the post-seam re-run on merged ref `4a2eb8d` — the artifact to keep for the gate). This note remains
> as the history: scan ran **pre-seam → cure committed on the seam branch → re-run post-merge for the
> gate**. **Do not commit the raw pre-seam scan artifact** — committing it would create a competing,
> stale plan (the duplicate-plan failure mode the GATEWAY work hit). The live actions below are now
> **done**: seam merged + double clone collapsed, `validate:publish` green, scan re-run → READY.

## TL;DR

The portability scan ran against the OSS repo **before the seam swap**. Every blocker it raised is the
exact `@repo/*`-shared-config dependency the seam branch already removed. The cure is committed; the
isolated-clone proof already passed. The scan is therefore **stale, not wrong** — it is evidence *for*
the seam branch, not a new work plan.

## What the scan found vs. what is already done

| Scan finding (pre-seam) | Reality on `extraction/oss-seam` |
| --- | --- |
| 5 packages depend on shared `@repo/*` build config (`@repo/typescript-config`) | **Cured.** `2547c83` — Option B: repoint the 5 `tsconfig`s to a **local base** + parity flags + DOM lib; drop `@repo/typescript-config`. |
| Strictness/parity gaps once off the shared base | **Cured.** `97bd271` — strictness fixes for the 5 packages under the unified local base. |
| Scan's own count: the dev-dependency was present on **4 of 5**, not all 5 | **Matches.** the devDep was dropped from the **4** packages that actually carried it — the scan's 4-not-5 finding is consistent with the cure, not a discrepancy. |
| Will it build standalone with `@repo/*` absent? | **Proven.** isolated-clone build passed **34/34**; `@repo` absent from both the lockfile and the pnpm store in the clean clone. |

**Net:** the scan's five blockers ≡ the swap already applied on `extraction/oss-seam` (`2547c83`
config-only + `97bd271` strictness), with the isolated-clone proof already green.

## Live actions that remain (the only forward work)

1. **Land/merge `extraction/oss-seam` and collapse the double clone.** The OSS code currently exists in
   two clones; the **platform clone is canonical** (already a checklist precondition). Merge the seam
   branch, then collapse to the single canonical clone so there is no second source of truth.
2. **Verify `validate:publish` / changeset runs in standalone CI** on the merged ref (the scan checks
   the package graph, not the release pipeline — confirm publish validation is green outside the
   monorepo).
3. **(Optional) Clean up the legacy `@loopengine` no-hyphen aliases** — cosmetic/name-hygiene, not a
   build blocker.

## Then: re-run for the gate

Once `extraction/oss-seam` is merged and the double clone is collapsed, **re-run the portability scan
on the merged ref** to produce the **evidenced-READY** artifact for the OSS build-portability gate.
That re-run — against post-seam state — is the artifact to keep; this note is superseded by it.

## Why a note and not the artifact

The raw scan describes a state that no longer exists. Persisted as-is it becomes a competing plan that
re-asserts already-cured blockers (the duplicate-plan failure mode). The durable record is: **scan ran
pre-seam → cure committed on the seam branch → re-run post-merge for the gate.**
