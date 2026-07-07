// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/**
 * `@loop-engine/evidence` — Decision Record evidence contracts (ADR-0004 WP-1).
 *
 * WP-1 step 1: types and ports only.
 *   - version metadata (`decisionRecordVersion`, `invariantVersion`, `canonicalVersion`)
 *   - commit/persisted snapshot shapes
 *   - `SnapshotStore` insert-only port
 *
 * Canonicalization, hashing, structural validation, and runtime enforcement
 * land in subsequent WP-1 steps — not in this package's early scope.
 */
export type {
  DecisionRecordVersionMetadata,
  EvidenceLineageRef,
  EvidenceSnapshotCommitInput,
  EvidenceSnapshotPersisted,
  EvidenceSnapshotRefs,
} from "./types.js";
export { LAUNCH_DECISION_RECORD_VERSIONS } from "./types.js";
export type { SnapshotStore } from "./snapshot-store.js";
