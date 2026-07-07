# @loop-engine/evidence

Decision Record evidence types and the `SnapshotStore` persistence port for
engine-enforced invariants ([ADR-0004](https://github.com/loopengine/loop-engine)).

Apache-2.0 OSS substrate. Intentionally boring: **types, version metadata,
ports, and canonicalization helpers** in WP-1 steps 1–2. Hashing, structural
validation, and runtime enforcement follow in later WP-1 steps.

## WP-1 scope

**Step 1**

- `DecisionRecordVersionMetadata` — `decisionRecordVersion`, `invariantVersion`,
  `canonicalVersion` (all `1` at launch)
- `EvidenceSnapshotCommitInput` / `EvidenceSnapshotPersisted`
- `SnapshotStore` — insert-only port; implemented by consumers (Boss Loops adapter)

**Step 2**

- `canonicalizeSnapshotValues(values)` — canonical JSON for semantic `values`
  via `@loop-engine/canonical-json` (Phase 3 input; never ORM row serialization)

**Step 3**

- `snapshotContentHash(values)` — lowercase hex SHA-256 of canonical semantic
  `values`; produces `contentSha256` at commit (Phase 3)

**Step 4**

- `SnapshotStore` + `SnapshotStoreInsertInput` — insert-only persistence port
- Structural validators for Phase 2 / 4:
  `validateEvidenceSnapshotCommitInput`, `validateEvidenceSnapshotCommitBatch`,
  `validateGovernedEvidencePresent`, `validateEvidenceSnapshotPersisted*`

**Step 5**

- `commitGovernedEvidenceSnapshots()` — Phases 2–4 orchestration
- `LoopEngine.transition()` wires governed path after guards; Phase 5 commits
  `snapshotIds` + `versions` on transition record

## Dependency direction

```text
Loop Engine → SnapshotStore interface → consumer adapter → database
```

The OSS engine must never import Prisma or proprietary database packages.

## Authority

Implementation spec: Boss Loops `docs/specs/engine-enforcement-invariants-spec.md`
(Phase 0 locked).
