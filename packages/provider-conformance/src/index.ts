// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import {
  snapshotContentHash,
  validateEvidenceSnapshotProposed,
  type EvidenceSnapshotProposed,
} from "@loop-engine/evidence";
import {
  loadGoldenExemplars,
  type GoldenExemplarFixture,
} from "@loop-engine/golden-exemplars";

export const CONFORMANCE_SUITE_VERSION = "provider-conformance-0.1.0";

export type ConformanceCheckResult = {
  code: string;
  message: string;
  path?: string;
};

export type ConformanceReport = {
  suiteVersion: string;
  exemplarId?: string;
  valid: boolean;
  checks: ConformanceCheckResult[];
};

function checkCanonicalHash(snapshot: EvidenceSnapshotProposed): ConformanceCheckResult[] {
  const hash = snapshotContentHash(snapshot.values);
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    return [{ code: "invalid_hash", message: "content hash must be 64-char hex" }];
  }
  if (snapshot.contentSha256 && snapshot.contentSha256 !== hash) {
    return [{ code: "hash_mismatch", message: "contentSha256 does not match canonical values hash" }];
  }
  return [];
}

function checkNativeMetadataIsolation(snapshot: EvidenceSnapshotProposed): ConformanceCheckResult[] {
  const forbiddenInValues = ["lookml", "snowflake", "power bi", "semantic view"];
  const valuesText = JSON.stringify(snapshot.values).toLowerCase();
  for (const term of forbiddenInValues) {
    if (valuesText.includes(term)) {
      return [{
        code: "native_term_in_values",
        message: `provider-native term "${term}" must live in nativeMetadata, not values`,
      }];
    }
  }
  return [];
}

function checkExemplarExpectations(fixture: GoldenExemplarFixture): ConformanceCheckResult[] {
  const checks: ConformanceCheckResult[] = [];

  if (fixture.id === "E02") {
    if (fixture.snapshot.qualification.definition === "governed") {
      checks.push({
        code: "false_governance_mapping",
        message: "E02 ad-hoc query must not map to governed definition",
      });
    }
    if (fixture.snapshot.qualification.definition !== "unreviewed") {
      checks.push({
        code: "e02_definition_expectation",
        message: "E02 ad-hoc query must map to unreviewed definition",
      });
    }
  }

  return checks;
}

/** Run Set 0 + Set 0.5 checks on a proposed snapshot. */
export function runConformanceChecks(
  snapshot: EvidenceSnapshotProposed,
  context?: { exemplarId?: string },
): ConformanceReport {
  const checks: ConformanceCheckResult[] = [];

  const structural = validateEvidenceSnapshotProposed(snapshot);
  if (!structural.valid) {
    checks.push(
      ...structural.errors.map((error) => ({
        code: error.code,
        message: error.message,
        path: error.path,
      })),
    );
  }

  checks.push(...checkCanonicalHash(snapshot));
  checks.push(...checkNativeMetadataIsolation(snapshot));

  return {
    suiteVersion: CONFORMANCE_SUITE_VERSION,
    exemplarId: context?.exemplarId,
    valid: checks.length === 0,
    checks,
  };
}

/** Validate all loaded golden exemplars (Set 0.5 gate). */
export function runGoldenExemplarConformanceSuite(): ConformanceReport[] {
  return loadGoldenExemplars().map((fixture) => {
    const report = runConformanceChecks(fixture.snapshot, { exemplarId: fixture.id });
    report.checks.push(...checkExemplarExpectations(fixture));
    report.valid = report.checks.length === 0;
    return report;
  });
}

export function assertGoldenExemplarSuitePasses(): void {
  const reports = runGoldenExemplarConformanceSuite();
  const failures = reports.filter((report) => !report.valid);
  if (failures.length > 0) {
    const detail = failures
      .map((f) => `${f.exemplarId}: ${f.checks.map((c) => c.message).join("; ")}`)
      .join("\n");
    throw new Error(`golden exemplar conformance failed:\n${detail}`);
  }
}
