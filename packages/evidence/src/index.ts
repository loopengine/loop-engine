// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/**
 * `@loop-engine/evidence` — Decision Record evidence contracts (ADR-0004 WP-1).
 *
 * WP-1 step 1: types and ports.
 * WP-1 step 2: `canonicalizeSnapshotValues()` (delegates to canonical-json).
 * WP-1 step 3: `snapshotContentHash()` (sha256 of canonical semantic values).
 * WP-1 step 4: `SnapshotStore` port + structural validators (Phase 2 / 4).
 * WP-1 step 5: `commitGovernedEvidenceSnapshots()` pipeline helper (Phases 2–4).
 */
export type {
  DecisionRecordVersionMetadata,
  EvidenceLineageRef,
  EvidenceSnapshotCommitInput,
  EvidenceSnapshotPersisted,
  EvidenceSnapshotRefs,
} from "./types.js";
export { LAUNCH_DECISION_RECORD_VERSIONS } from "./types.js";
export type { SnapshotStore, SnapshotStoreInsertInput } from "./snapshot-store.js";
export {
  canonicalizeSnapshotValues,
  type SnapshotSemanticValues,
} from "./canonicalize-snapshot-values.js";
export { snapshotContentHash } from "./snapshot-content-hash.js";
export type {
  GovernedEvidenceCommitFailure,
  GovernedEvidenceCommitParams,
  GovernedEvidenceCommitResult,
  GovernedEvidenceCommitSuccess,
  GovernedEvidenceRejectionReason,
} from "./governed-evidence-commit.js";
export {
  commitGovernedEvidenceSnapshots,
  requiresGovernedEvidence,
} from "./governed-evidence-commit.js";
export type {
  EvidenceValidationError,
  EvidenceValidationResult,
} from "./validate-evidence-snapshot.js";
export {
  validateDecisionRecordVersions,
  validateEvidenceSnapshotCommitBatch,
  validateEvidenceSnapshotCommitInput,
  validateEvidenceSnapshotPersisted,
  validateEvidenceSnapshotPersistedBatch,
  validateGovernedEvidencePresent,
} from "./validate-evidence-snapshot.js";
