// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { CanonicalizationError } from "@loop-engine/canonical-json";
import { snapshotContentHash } from "./snapshot-content-hash.js";
import type { SnapshotStore } from "./snapshot-store.js";
import type {
  EvidenceSnapshotCommitInput,
  EvidenceSnapshotPersisted,
  EvidenceSnapshotRefs,
} from "./types.js";
import { LAUNCH_DECISION_RECORD_VERSIONS } from "./types.js";
import {
  validateEvidenceSnapshotCommitBatch,
  validateGovernedEvidencePresent,
} from "./validate-evidence-snapshot.js";

export type GovernedEvidenceRejectionReason =
  | "evidence_required"
  | "invalid_evidence_snapshot"
  | "snapshot_store_required";

export type GovernedEvidenceCommitSuccess = {
  ok: true;
  snapshotIds: string[];
  persisted: EvidenceSnapshotPersisted[];
  refs: EvidenceSnapshotRefs;
};

export type GovernedEvidenceCommitFailure = {
  ok: false;
  rejectionReason: GovernedEvidenceRejectionReason;
  message: string;
};

export type GovernedEvidenceCommitResult =
  | GovernedEvidenceCommitSuccess
  | GovernedEvidenceCommitFailure;

export type GovernedEvidenceCommitParams = {
  tenantId: string;
  aggregateId: string;
  evidenceSnapshots: unknown;
  snapshotStore?: SnapshotStore;
  createSnapshotId?: () => string;
};

/** Whether loop or transition metadata requires governed evidence snapshots. */
export function requiresGovernedEvidence(metadata?: {
  loopMetadata?: Record<string, unknown>;
  transitionMetadata?: Record<string, unknown>;
}): boolean {
  return (
    metadata?.loopMetadata?.governedEvidence === true ||
    metadata?.transitionMetadata?.governedEvidence === true
  );
}

/**
 * Phases 2–4 for governed transitions: structural validation, canonical hash,
 * and insert-only persistence via {@link SnapshotStore}.
 */
export async function commitGovernedEvidenceSnapshots(
  params: GovernedEvidenceCommitParams
): Promise<GovernedEvidenceCommitResult> {
  const present = validateGovernedEvidencePresent(params.evidenceSnapshots);
  if (!present.valid) {
    return {
      ok: false,
      rejectionReason: "evidence_required",
      message: present.errors[0]?.message ?? "evidence required",
    };
  }

  const structural = validateEvidenceSnapshotCommitBatch(params.evidenceSnapshots);
  if (!structural.valid) {
    return {
      ok: false,
      rejectionReason: "invalid_evidence_snapshot",
      message: structural.errors.map((error) => error.message).join("; "),
    };
  }

  const snapshots = params.evidenceSnapshots as EvidenceSnapshotCommitInput[];
  const createId = params.createSnapshotId ?? (() => crypto.randomUUID());
  const persisted: EvidenceSnapshotPersisted[] = [];

  try {
    for (const snapshot of snapshots) {
      const contentSha256 = snapshotContentHash(snapshot.values);
      if (
        snapshot.contentSha256 !== undefined &&
        snapshot.contentSha256 !== contentSha256
      ) {
        return {
          ok: false,
          rejectionReason: "invalid_evidence_snapshot",
          message: `contentSha256 mismatch for snapshotKey ${snapshot.snapshotKey}`,
        };
      }
      persisted.push({
        ...snapshot,
        id: createId(),
        contentSha256,
      });
    }
  } catch (error) {
    const message =
      error instanceof CanonicalizationError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return {
      ok: false,
      rejectionReason: "invalid_evidence_snapshot",
      message,
    };
  }

  if (!params.snapshotStore) {
    return {
      ok: false,
      rejectionReason: "snapshot_store_required",
      message: "governed evidence transition requires a SnapshotStore",
    };
  }

  const { snapshotIds } = await params.snapshotStore.insertSnapshots({
    tenantId: params.tenantId,
    aggregateId: params.aggregateId,
    snapshots: persisted,
  });

  return {
    ok: true,
    snapshotIds,
    persisted,
    refs: {
      snapshotIds,
      versions: LAUNCH_DECISION_RECORD_VERSIONS,
    },
  };
}
