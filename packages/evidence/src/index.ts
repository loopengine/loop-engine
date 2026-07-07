// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/**
 * `@loop-engine/evidence` — Decision Record evidence contracts (ADR-0004 WP-1).
 *
 * WP-1 step 1: types and ports.
 * WP-1 step 2: `canonicalizeSnapshotValues()` (delegates to canonical-json).
 *
 * Hashing, structural validation, and runtime enforcement land in later steps.
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
export {
  canonicalizeSnapshotValues,
  type SnapshotSemanticValues,
} from "./canonicalize-snapshot-values.js";
