// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import type { EvidenceSnapshotCommitInput } from "./types.js";

export type EvidenceValidationError = {
  code: string;
  message: string;
  path?: string;
};

export type EvidenceValidationResult = {
  valid: boolean;
  errors: EvidenceValidationError[];
};

const SUPPORTED_DECISION_RECORD_VERSION = 1 as const;
const SUPPORTED_INVARIANT_VERSION = 1 as const;
const SUPPORTED_CANONICAL_VERSION = 1 as const;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

function ok(): EvidenceValidationResult {
  return { valid: true, errors: [] };
}

function fail(errors: EvidenceValidationError[]): EvidenceValidationResult {
  return { valid: false, errors };
}

function merge(...results: EvidenceValidationResult[]): EvidenceValidationResult {
  const errors = results.flatMap((r) => r.errors);
  return errors.length === 0 ? ok() : fail(errors);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIso8601Timestamp(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function childPath(base: string, key: string | number): string {
  return base === "$" ? `$.${String(key)}` : `${base}.${String(key)}`;
}

/** Structural validation for launch version metadata (invariantVersion = 1). */
export function validateDecisionRecordVersions(
  versions: unknown,
  path = "$.versions"
): EvidenceValidationResult {
  if (!isPlainObject(versions)) {
    return fail([
      {
        code: "invalid_versions",
        message: "versions must be an object",
        path,
      },
    ]);
  }

  const errors: EvidenceValidationError[] = [];
  const record = versions as Record<string, unknown>;

  if (record.decisionRecordVersion !== SUPPORTED_DECISION_RECORD_VERSION) {
    errors.push({
      code: "unsupported_decision_record_version",
      message: `decisionRecordVersion must be ${SUPPORTED_DECISION_RECORD_VERSION}`,
      path: childPath(path, "decisionRecordVersion"),
    });
  }
  if (record.invariantVersion !== SUPPORTED_INVARIANT_VERSION) {
    errors.push({
      code: "unsupported_invariant_version",
      message: `invariantVersion must be ${SUPPORTED_INVARIANT_VERSION}`,
      path: childPath(path, "invariantVersion"),
    });
  }
  if (record.canonicalVersion !== SUPPORTED_CANONICAL_VERSION) {
    errors.push({
      code: "unsupported_canonical_version",
      message: `canonicalVersion must be ${SUPPORTED_CANONICAL_VERSION}`,
      path: childPath(path, "canonicalVersion"),
    });
  }

  return errors.length === 0 ? ok() : fail(errors);
}

function validateEvidenceLineageRef(
  ref: unknown,
  path: string
): EvidenceValidationResult {
  if (!isPlainObject(ref)) {
    return fail([
      { code: "invalid_lineage_ref", message: "lineage entry must be an object", path },
    ]);
  }
  const record = ref as Record<string, unknown>;
  const errors: EvidenceValidationError[] = [];
  if (record.kind !== "source" && record.kind !== "derived-input") {
    errors.push({
      code: "invalid_lineage_kind",
      message: 'lineage kind must be "source" or "derived-input"',
      path: childPath(path, "kind"),
    });
  }
  if (!nonEmptyString(record.ref)) {
    errors.push({
      code: "missing_lineage_ref",
      message: "lineage ref must be a non-empty string",
      path: childPath(path, "ref"),
    });
  }
  return errors.length === 0 ? ok() : fail(errors);
}

/**
 * Phase 2 structural validation for a single commit snapshot.
 * Does not canonicalize or verify contentSha256 — that is Phase 3.
 */
export function validateEvidenceSnapshotCommitInput(
  input: unknown,
  path = "$"
): EvidenceValidationResult {
  if (!isPlainObject(input)) {
    return fail([
      {
        code: "invalid_snapshot",
        message: "evidence snapshot must be an object",
        path,
      },
    ]);
  }

  const snapshot = input as Record<string, unknown>;
  const errors: EvidenceValidationResult[] = [];

  const requiredStrings: Array<[keyof EvidenceSnapshotCommitInput, string]> = [
    ["snapshotKey", "snapshotKey must be a non-empty string"],
    ["sourceSystem", "sourceSystem must be a non-empty string"],
    ["capturedAt", "capturedAt must be a non-empty ISO-8601 timestamp"],
    ["capturedBy", "capturedBy must be a non-empty string"],
  ];

  for (const [key, message] of requiredStrings) {
    const value = snapshot[key as string];
    if (!nonEmptyString(value)) {
      errors.push(
        fail([
          {
            code: "missing_provenance",
            message,
            path: childPath(path, key as string),
          },
        ])
      );
      continue;
    }
    if (key === "capturedAt" && !isIso8601Timestamp(value)) {
      errors.push(
        fail([
          {
            code: "invalid_captured_at",
            message: "capturedAt must be a parseable ISO-8601 timestamp",
            path: childPath(path, "capturedAt"),
          },
        ])
      );
    }
  }

  if (!isPlainObject(snapshot.values)) {
    errors.push(
      fail([
        {
          code: "invalid_values",
          message: "values must be a plain object",
          path: childPath(path, "values"),
        },
      ])
    );
  }

  errors.push(validateDecisionRecordVersions(snapshot.versions, childPath(path, "versions")));

  if (snapshot.lineage !== undefined) {
    if (!Array.isArray(snapshot.lineage)) {
      errors.push(
        fail([
          {
            code: "invalid_lineage",
            message: "lineage must be an array when present",
            path: childPath(path, "lineage"),
          },
        ])
      );
    } else {
      snapshot.lineage.forEach((entry, index) => {
        errors.push(
          validateEvidenceLineageRef(entry, childPath(childPath(path, "lineage"), index))
        );
      });
    }
  }

  if (snapshot.sequence !== undefined) {
    if (
      typeof snapshot.sequence !== "number" ||
      !Number.isInteger(snapshot.sequence) ||
      snapshot.sequence < 0
    ) {
      errors.push(
        fail([
          {
            code: "invalid_sequence",
            message: "sequence must be a non-negative integer when present",
            path: childPath(path, "sequence"),
          },
        ])
      );
    }
  }

  if (
    snapshot.contentSha256 !== undefined &&
    (typeof snapshot.contentSha256 !== "string" || !SHA256_HEX_RE.test(snapshot.contentSha256))
  ) {
    errors.push(
      fail([
        {
          code: "invalid_content_sha256",
          message: "contentSha256 must be lowercase hex SHA-256 when present",
          path: childPath(path, "contentSha256"),
        },
      ])
    );
  }

  return merge(...errors);
}

/** Phase 2 batch validation — structural completeness and unique snapshot keys. */
export function validateEvidenceSnapshotCommitBatch(
  snapshots: unknown
): EvidenceValidationResult {
  if (!Array.isArray(snapshots)) {
    return fail([
      {
        code: "invalid_snapshot_batch",
        message: "evidenceSnapshots must be an array",
        path: "$",
      },
    ]);
  }

  const errors: EvidenceValidationResult[] = [];
  const keys = new Set<string>();

  snapshots.forEach((snapshot, index) => {
    const path = `$[${index}]`;
    const result = validateEvidenceSnapshotCommitInput(snapshot, path);
    errors.push(result);

    if (isPlainObject(snapshot) && nonEmptyString(snapshot.snapshotKey)) {
      if (keys.has(snapshot.snapshotKey)) {
        errors.push(
          fail([
            {
              code: "duplicate_snapshot_key",
              message: `duplicate snapshotKey: ${snapshot.snapshotKey}`,
              path: childPath(path, "snapshotKey"),
            },
          ])
        );
      } else {
        keys.add(snapshot.snapshotKey);
      }
    }
  });

  return merge(...errors);
}

/** Governed consequential transitions require at least one snapshot. */
export function validateGovernedEvidencePresent(
  snapshots: unknown
): EvidenceValidationResult {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return fail([
      {
        code: "evidence_required",
        message: "governed consequential transition requires at least one evidence snapshot",
        path: "$.evidenceSnapshots",
      },
    ]);
  }
  return ok();
}

/** Structural validation for rows passed to SnapshotStore.insertSnapshots. */
export function validateEvidenceSnapshotPersisted(
  snapshot: unknown,
  path = "$"
): EvidenceValidationResult {
  const commitResult = validateEvidenceSnapshotCommitInput(snapshot, path);
  if (!commitResult.valid) {
    return commitResult;
  }

  if (!isPlainObject(snapshot)) {
    return fail([
      { code: "invalid_snapshot", message: "persisted snapshot must be an object", path },
    ]);
  }

  const record = snapshot as Record<string, unknown>;
  const errors: EvidenceValidationError[] = [];

  if (!nonEmptyString(record.id)) {
    errors.push({
      code: "missing_snapshot_id",
      message: "id must be a non-empty string",
      path: childPath(path, "id"),
    });
  }

  if (typeof record.contentSha256 !== "string" || !SHA256_HEX_RE.test(record.contentSha256)) {
    errors.push({
      code: "missing_content_sha256",
      message: "contentSha256 must be lowercase hex SHA-256",
      path: childPath(path, "contentSha256"),
    });
  }

  return errors.length === 0 ? ok() : fail(errors);
}

export function validateEvidenceSnapshotPersistedBatch(
  snapshots: unknown
): EvidenceValidationResult {
  if (!Array.isArray(snapshots)) {
    return fail([
      {
        code: "invalid_snapshot_batch",
        message: "snapshots must be an array",
        path: "$",
      },
    ]);
  }

  return merge(
    ...snapshots.map((snapshot, index) =>
      validateEvidenceSnapshotPersisted(snapshot, `$[${index}]`)
    )
  );
}
