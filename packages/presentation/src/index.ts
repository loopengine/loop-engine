// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import type {
  DefinitionRung,
  EvidenceSnapshotProposed,
  FreshnessQualification,
  ProvenanceRung,
  QualificationVector,
} from "@loop-engine/evidence";

export type ProvenanceIndicatorLevel = "low" | "medium" | "high";

const PROVENANCE_LABELS: Record<ProvenanceRung, string> = {
  unknown: "Unknown provenance",
  "system-attested": "System attested",
  "origin-attested": "Origin attested",
};

const DEFINITION_LABELS: Record<DefinitionRung, string> = {
  "not-applicable": "Not applicable",
  unreviewed: "Unreviewed",
  certified: "Certified",
  governed: "Governed",
};

export function formatProvenanceRung(rung: ProvenanceRung): string {
  return PROVENANCE_LABELS[rung];
}

export function formatDefinitionRung(rung: DefinitionRung): string {
  return DEFINITION_LABELS[rung];
}

export function formatFreshnessQualification(
  freshness: FreshnessQualification,
): string {
  if (freshness.applicable === "not-applicable") {
    return "Freshness not applicable";
  }
  const verdict = freshness.freshnessVerdict ?? "unknown";
  return `Freshness: ${verdict}`;
}

export function provenanceIndicatorLevel(
  rung: ProvenanceRung,
): ProvenanceIndicatorLevel {
  if (rung === "origin-attested") return "high";
  if (rung === "system-attested") return "medium";
  return "low";
}

export type QualificationBadge = {
  provenance: { label: string; level: ProvenanceIndicatorLevel };
  definition: { label: string };
  freshness: { label: string };
};

/** Headless qualification badge for evidence cards (Set 1 foundation). */
export function qualificationBadge(vector: QualificationVector): QualificationBadge {
  return {
    provenance: {
      label: formatProvenanceRung(vector.provenance),
      level: provenanceIndicatorLevel(vector.provenance),
    },
    definition: { label: formatDefinitionRung(vector.definition) },
    freshness: { label: formatFreshnessQualification(vector.freshness) },
  };
}

export type EvidenceCardSummary = {
  snapshotKey: string;
  sourceSystem: string;
  capturedAt: string;
  badge: QualificationBadge;
};

/** Minimal evidence card summary from a proposed or frozen snapshot. */
export function evidenceCardSummary(
  snapshot: Pick<
    EvidenceSnapshotProposed,
    "snapshotKey" | "sourceSystem" | "capturedAt" | "qualification"
  >,
): EvidenceCardSummary {
  return {
    snapshotKey: snapshot.snapshotKey,
    sourceSystem: snapshot.sourceSystem,
    capturedAt: snapshot.capturedAt,
    badge: qualificationBadge(snapshot.qualification),
  };
}
