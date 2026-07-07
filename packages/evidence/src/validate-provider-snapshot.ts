// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import type { EvidenceValidationError, EvidenceValidationResult } from "./validate-evidence-snapshot.js";
import type { QualificationVector } from "./qualification.js";
import type { EvidenceSnapshotProposed } from "./provider-snapshot-contract.js";
import {
  DEFINITION_ORDER,
  PROVENANCE_ORDER,
  isFreshnessApplicable,
} from "./qualification.js";
import { validateDecisionRecordVersions } from "./validate-evidence-snapshot.js";

function ok(): EvidenceValidationResult {
  return { valid: true, errors: [] };
}

function fail(errors: EvidenceValidationError[]): EvidenceValidationResult {
  return { valid: false, errors };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateQualificationVector(
  qualification: unknown,
  path = "$.qualification",
): EvidenceValidationResult {
  if (!isPlainObject(qualification)) {
    return fail([{ code: "invalid_qualification", message: "qualification must be an object", path }]);
  }

  const q = qualification as Record<string, unknown>;
  const errors: EvidenceValidationError[] = [];

  if (!PROVENANCE_ORDER.includes(q.provenance as (typeof PROVENANCE_ORDER)[number])) {
    errors.push({
      code: "invalid_provenance_rung",
      message: `provenance must be one of ${PROVENANCE_ORDER.join(", ")}`,
      path: `${path}.provenance`,
    });
  }

  if (!DEFINITION_ORDER.includes(q.definition as (typeof DEFINITION_ORDER)[number])) {
    errors.push({
      code: "invalid_definition_rung",
      message: `definition must be one of ${DEFINITION_ORDER.join(", ")}`,
      path: `${path}.definition`,
    });
  }

  const freshness = q.freshness;
  if (!isPlainObject(freshness)) {
    errors.push({
      code: "invalid_freshness",
      message: "freshness must be an object",
      path: `${path}.freshness`,
    });
  } else if (freshness.applicable === "not-applicable") {
    // valid
  } else if (freshness.applicable === "applicable") {
    if (!nonEmptyString(freshness.snapshotFrozenAt)) {
      errors.push({
        code: "missing_snapshot_frozen_at",
        message: "snapshotFrozenAt required when freshness is applicable",
        path: `${path}.freshness.snapshotFrozenAt`,
      });
    }
    if (!nonEmptyString(freshness.valueAsOf)) {
      errors.push({
        code: "missing_value_as_of",
        message: "valueAsOf required when freshness is applicable",
        path: `${path}.freshness.valueAsOf`,
      });
    }
  } else {
    errors.push({
      code: "invalid_freshness_applicable",
      message: 'freshness.applicable must be "not-applicable" or "applicable"',
      path: `${path}.freshness.applicable`,
    });
  }

  return errors.length === 0 ? ok() : fail(errors);
}

/** Structural validation for Set 0 provider contract snapshots. */
export function validateEvidenceSnapshotProposed(
  input: unknown,
): EvidenceValidationResult {
  if (!isPlainObject(input)) {
    return fail([{ code: "invalid_snapshot", message: "snapshot must be an object", path: "$" }]);
  }

  const snapshot = input as Record<string, unknown>;
  const errors: EvidenceValidationError[] = [];

  for (const field of ["snapshotKey", "sourceSystem", "capturedAt", "capturedBy"] as const) {
    if (!nonEmptyString(snapshot[field])) {
      errors.push({
        code: "missing_field",
        message: `${field} is required`,
        path: `$.${field}`,
      });
    }
  }

  if (!isPlainObject(snapshot.values)) {
    errors.push({
      code: "invalid_values",
      message: "values must be an object",
      path: "$.values",
    });
  }

  const versionResult = validateDecisionRecordVersions(snapshot.versions, "$.versions");
  errors.push(...versionResult.errors);

  const qualResult = validateQualificationVector(snapshot.qualification);
  errors.push(...qualResult.errors);

  if (snapshot.measurements !== undefined && !isPlainObject(snapshot.measurements)) {
    errors.push({
      code: "invalid_measurements",
      message: "measurements must be an object when present",
      path: "$.measurements",
    });
  }

  if (snapshot.nativeMetadata !== undefined && !isPlainObject(snapshot.nativeMetadata)) {
    errors.push({
      code: "invalid_native_metadata",
      message: "nativeMetadata must be an object when present",
      path: "$.nativeMetadata",
    });
  }

  if (snapshot.version !== undefined) {
    if (!isPlainObject(snapshot.version)) {
      errors.push({
        code: "invalid_version_constraint",
        message: "version must be an object when present",
        path: "$.version",
      });
    } else {
      const v = snapshot.version as Record<string, unknown>;
      if (v.kind !== "must_equal" && v.kind !== "must_be_in") {
        errors.push({
          code: "invalid_version_kind",
          message: 'version.kind must be "must_equal" or "must_be_in"',
          path: "$.version.kind",
        });
      }
    }
  }

  return errors.length === 0 ? ok() : fail(errors);
}

export function assertQualificationVector(
  vector: QualificationVector,
): QualificationVector {
  const result = validateQualificationVector(vector);
  if (!result.valid) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  return vector;
}

export function assertEvidenceSnapshotProposed(
  snapshot: EvidenceSnapshotProposed,
): EvidenceSnapshotProposed {
  const result = validateEvidenceSnapshotProposed(snapshot);
  if (!result.valid) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  return snapshot;
}
