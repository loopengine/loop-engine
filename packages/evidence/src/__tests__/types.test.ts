import { describe, expect, it } from "vitest";
import {
  LAUNCH_DECISION_RECORD_VERSIONS,
  type EvidenceSnapshotCommitInput,
  type EvidenceSnapshotPersisted,
} from "../index.js";

describe("@loop-engine/evidence types", () => {
  it("exposes launch version metadata with all fields set to 1", () => {
    expect(LAUNCH_DECISION_RECORD_VERSIONS).toEqual({
      decisionRecordVersion: 1,
      invariantVersion: 1,
      canonicalVersion: 1,
    });
  });

  it("accepts commit input and persisted snapshot shapes", () => {
    const commit: EvidenceSnapshotCommitInput = {
      snapshotKey: "invoice-summary",
      sourceSystem: "snowflake",
      capturedAt: "2026-07-07T12:00:00.000Z",
      capturedBy: "actor-1",
      values: { amount: 12500, currency: "USD" },
      versions: LAUNCH_DECISION_RECORD_VERSIONS,
    };

    const persisted: EvidenceSnapshotPersisted = {
      ...commit,
      id: "snap_01",
      contentSha256: "abc123",
    };

    expect(persisted.contentSha256).toBe("abc123");
    expect(persisted.versions.invariantVersion).toBe(1);
  });
});
