# @loop-engine/evidence

Decision Record evidence types and the `SnapshotStore` persistence port for
engine-enforced invariants ([ADR-0004](https://github.com/loopengine/loop-engine)).

Apache-2.0 OSS substrate. Intentionally boring: **types, version metadata,
and ports only** in WP-1 step 1. Canonicalization, hashing, structural
validation, and runtime enforcement follow in later WP-1 steps.

## WP-1 scope (step 1)

- `DecisionRecordVersionMetadata` — `decisionRecordVersion`, `invariantVersion`,
  `canonicalVersion` (all `1` at launch)
- `EvidenceSnapshotCommitInput` / `EvidenceSnapshotPersisted`
- `SnapshotStore` — insert-only port; implemented by consumers (Boss Loops adapter)

## Dependency direction

```text
Loop Engine → SnapshotStore interface → consumer adapter → database
```

The OSS engine must never import Prisma or proprietary database packages.

## Authority

Implementation spec: Boss Loops `docs/specs/engine-enforcement-invariants-spec.md`
(Phase 0 locked).
