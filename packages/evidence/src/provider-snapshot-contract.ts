// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/**
 * ADR-0005 Set 0 — EvidenceSnapshot provider contract DTO.
 *
 * Extends WP-1 commit input with qualification vector, version identity,
 * measurements (opaque), and native metadata isolation boundaries.
 */

import type { EvidenceLineageRef, DecisionRecordVersionMetadata } from "./types.js";
import type {
  FreshnessQualification,
  QualificationVector,
  VersionIdentityConstraint,
} from "./qualification.js";

/** Provider-proposed snapshot before engine freeze (ADR-0005). */
export type EvidenceSnapshotProposed = {
  snapshotKey: string;
  sourceSystem: string;
  sourceRef?: string;
  capturedAt: string;
  capturedBy: string;
  values: Record<string, unknown>;
  versions: DecisionRecordVersionMetadata;
  qualification: QualificationVector;
  lineage?: EvidenceLineageRef[];
  version?: VersionIdentityConstraint;
  /** Quantitative properties — opaque until Canon promotes a key (ADR-0005). */
  measurements?: Record<string, unknown>;
  /** Provider-native terms — must not leak into Canon vocabulary. */
  nativeMetadata?: Record<string, unknown>;
  timelineEvent?: string;
  timelineAt?: string;
  sequence?: number;
  providerId?: string;
  conformanceSuiteVersion?: string;
  /** Optional client hash — engine recomputes from `values` at commit. */
  contentSha256?: string;
  renderedArtifact?: EvidenceRenderedArtifact;
};

/** Frozen authoritative snapshot after engine commit (ADR-0004 + ADR-0005). */
export type EvidenceSnapshotContract = EvidenceSnapshotProposed & {
  id?: string;
  contentSha256: string;
};

export type EvidenceRenderedArtifact = {
  kind: "image" | "pdf" | "html" | "json";
  mimeType: string;
  uri?: string;
  /** Inline preview payload when uri absent (reference viewer only). */
  inlineBase64?: string;
};
