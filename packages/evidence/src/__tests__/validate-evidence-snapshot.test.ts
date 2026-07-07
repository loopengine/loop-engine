import { describe, expect, it } from "vitest";
import { LAUNCH_DECISION_RECORD_VERSIONS } from "../types.js";
import {
  validateDecisionRecordVersions,
  validateEvidenceSnapshotCommitBatch,
  validateEvidenceSnapshotCommitInput,
  validateEvidenceSnapshotPersisted,
  validateEvidenceSnapshotPersistedBatch,
  validateGovernedEvidencePresent,
} from "../validate-evidence-snapshot.js";

const validSnapshot = {
  snapshotKey: "invoice-summary",
  sourceSystem: "snowflake",
  capturedAt: "2026-07-07T12:00:00.000Z",
  capturedBy: "actor-1",
  values: { amount: 12500, currency: "USD" },
  versions: LAUNCH_DECISION_RECORD_VERSIONS,
};

describe("validateDecisionRecordVersions", () => {
  it("accepts launch version metadata", () => {
    expect(validateDecisionRecordVersions(LAUNCH_DECISION_RECORD_VERSIONS).valid).toBe(true);
  });

  it("rejects unsupported invariant versions", () => {
    const result = validateDecisionRecordVersions({
      decisionRecordVersion: 1,
      invariantVersion: 2,
      canonicalVersion: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("unsupported_invariant_version");
  });
});

describe("validateEvidenceSnapshotCommitInput", () => {
  it("accepts a structurally complete snapshot", () => {
    expect(validateEvidenceSnapshotCommitInput(validSnapshot).valid).toBe(true);
  });

  it("requires provenance fields", () => {
    const { sourceSystem: _s, ...rest } = validSnapshot;
    const result = validateEvidenceSnapshotCommitInput(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "missing_provenance")).toBe(true);
  });

  it("requires values to be a plain object", () => {
    const result = validateEvidenceSnapshotCommitInput({
      ...validSnapshot,
      values: ["not", "an", "object"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "invalid_values")).toBe(true);
  });

  it("validates optional lineage entries", () => {
    const result = validateEvidenceSnapshotCommitInput({
      ...validSnapshot,
      lineage: [{ kind: "source", ref: "sf://metric/invoice_total" }],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid lineage kind", () => {
    const result = validateEvidenceSnapshotCommitInput({
      ...validSnapshot,
      lineage: [{ kind: "narrative", ref: "story-1" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "invalid_lineage_kind")).toBe(true);
  });

  it("rejects malformed optional contentSha256", () => {
    const result = validateEvidenceSnapshotCommitInput({
      ...validSnapshot,
      contentSha256: "NOT_A_HASH",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "invalid_content_sha256")).toBe(true);
  });
});

describe("validateEvidenceSnapshotCommitBatch", () => {
  it("accepts a valid batch", () => {
    expect(validateEvidenceSnapshotCommitBatch([validSnapshot]).valid).toBe(true);
  });

  it("rejects duplicate snapshot keys", () => {
    const result = validateEvidenceSnapshotCommitBatch([validSnapshot, validSnapshot]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "duplicate_snapshot_key")).toBe(true);
  });
});

describe("validateGovernedEvidencePresent", () => {
  it("requires at least one snapshot", () => {
    expect(validateGovernedEvidencePresent([]).valid).toBe(false);
    expect(validateGovernedEvidencePresent(undefined).valid).toBe(false);
    expect(validateGovernedEvidencePresent([validSnapshot]).valid).toBe(true);
  });

  it("uses evidence_required code", () => {
    expect(validateGovernedEvidencePresent([]).errors[0]?.code).toBe("evidence_required");
  });
});

describe("validateEvidenceSnapshotPersisted", () => {
  it("requires id and contentSha256", () => {
    const result = validateEvidenceSnapshotPersisted({
      ...validSnapshot,
      id: "snap_01",
      contentSha256: "a".repeat(64),
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing contentSha256", () => {
    const result = validateEvidenceSnapshotPersisted({
      ...validSnapshot,
      id: "snap_01",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "missing_content_sha256")).toBe(true);
  });
});

describe("validateEvidenceSnapshotPersistedBatch", () => {
  it("validates each persisted row", () => {
    const result = validateEvidenceSnapshotPersistedBatch([
      { ...validSnapshot, id: "snap_01", contentSha256: "b".repeat(64) },
      { ...validSnapshot, snapshotKey: "other", id: "", contentSha256: "c".repeat(64) },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "missing_snapshot_id")).toBe(true);
  });
});
