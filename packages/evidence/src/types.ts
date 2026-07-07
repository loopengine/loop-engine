// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/**
 * Version metadata for governed decision commits.
 *
 * All fields are required on every governed commit. Launch values are `1`.
 * Bump `invariantVersion` when engine enforcement semantics change; old
 * records remain interpretable via their stored version tuple.
 */
export type DecisionRecordVersionMetadata = {
  /** Schema of the committed decision record envelope. */
  decisionRecordVersion: 1;
  /** Engine invariant set enforced at commit (Phase 2). */
  invariantVersion: 1;
  /** Canonical serialization rules (@loop-engine/canonical-json). */
  canonicalVersion: 1;
};

/** Launch-time version tuple — use when constructing governed commits. */
export const LAUNCH_DECISION_RECORD_VERSIONS: DecisionRecordVersionMetadata = {
  decisionRecordVersion: 1,
  invariantVersion: 1,
  canonicalVersion: 1,
};

export type EvidenceLineageRef = {
  kind: "source" | "derived-input";
  ref: string;
};

/**
 * Submitted at transition commit. Validated in Phases 2–3 of the commit pipeline.
 *
 * `values` is the semantic Decision Record payload — hashed in Phase 3, never
 * the database row or ORM serialization.
 */
export type EvidenceSnapshotCommitInput = {
  /** Stable key within the transition commit batch. */
  snapshotKey: string;
  sourceSystem: string;
  sourceRef?: string;
  /** ISO-8601 timestamp. */
  capturedAt: string;
  capturedBy: string;
  /** Semantic business record — canonicalized and hashed in Phase 3. */
  values: Record<string, unknown>;
  versions: DecisionRecordVersionMetadata;
  lineage?: EvidenceLineageRef[];
  timelineEvent?: string;
  timelineAt?: string;
  sequence?: number;
  /**
   * Optional client-supplied hash. Engine recomputes from `values` and rejects
   * on mismatch (Phase 3).
   */
  contentSha256?: string;
};

/** Persisted immutable snapshot after Phase 3–4. */
export type EvidenceSnapshotPersisted = EvidenceSnapshotCommitInput & {
  id: string;
  contentSha256: string;
};

/** Snapshot refs attached to a committed transition (Phase 5). */
export type EvidenceSnapshotRefs = {
  snapshotIds: string[];
  versions: DecisionRecordVersionMetadata;
};
