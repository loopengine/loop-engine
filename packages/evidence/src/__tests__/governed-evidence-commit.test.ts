import { describe, expect, it } from "vitest";
import { LAUNCH_DECISION_RECORD_VERSIONS } from "../types.js";
import {
  commitGovernedEvidenceSnapshots,
  requiresGovernedEvidence,
} from "../governed-evidence-commit.js";
import type { EvidenceSnapshotPersisted, SnapshotStore } from "../index.js";
import { snapshotContentHash } from "../snapshot-content-hash.js";

const validSnapshot = {
  snapshotKey: "invoice-summary",
  sourceSystem: "snowflake",
  capturedAt: "2026-07-07T12:00:00.000Z",
  capturedBy: "actor-1",
  values: { amount: 12500, currency: "USD" },
  versions: LAUNCH_DECISION_RECORD_VERSIONS,
};

class MemorySnapshotStore implements SnapshotStore {
  readonly rows: EvidenceSnapshotPersisted[] = [];

  async insertSnapshots(input: {
    tenantId: string;
    aggregateId: string;
    snapshots: EvidenceSnapshotPersisted[];
  }): Promise<{ snapshotIds: string[] }> {
    this.rows.push(...input.snapshots);
    return { snapshotIds: input.snapshots.map((row) => row.id) };
  }
}

describe("requiresGovernedEvidence", () => {
  it("is true when loop metadata marks governedEvidence", () => {
    expect(
      requiresGovernedEvidence({ loopMetadata: { governedEvidence: true } })
    ).toBe(true);
  });

  it("is true when transition metadata marks governedEvidence", () => {
    expect(
      requiresGovernedEvidence({ transitionMetadata: { governedEvidence: true } })
    ).toBe(true);
  });

  it("is false when metadata absent", () => {
    expect(requiresGovernedEvidence({})).toBe(false);
  });
});

describe("commitGovernedEvidenceSnapshots", () => {
  it("rejects missing snapshots", async () => {
    const result = await commitGovernedEvidenceSnapshots({
      tenantId: "tenant-1",
      aggregateId: "agg-1",
      evidenceSnapshots: [],
      snapshotStore: new MemorySnapshotStore(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejectionReason).toBe("evidence_required");
    }
  });

  it("rejects structural errors", async () => {
    const result = await commitGovernedEvidenceSnapshots({
      tenantId: "tenant-1",
      aggregateId: "agg-1",
      evidenceSnapshots: [{ snapshotKey: "only-key" }],
      snapshotStore: new MemorySnapshotStore(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejectionReason).toBe("invalid_evidence_snapshot");
    }
  });

  it("rejects hash mismatch", async () => {
    const result = await commitGovernedEvidenceSnapshots({
      tenantId: "tenant-1",
      aggregateId: "agg-1",
      evidenceSnapshots: [
        {
          ...validSnapshot,
          contentSha256: "f".repeat(64),
        },
      ],
      snapshotStore: new MemorySnapshotStore(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejectionReason).toBe("invalid_evidence_snapshot");
    }
  });

  it("requires SnapshotStore for governed commits", async () => {
    const result = await commitGovernedEvidenceSnapshots({
      tenantId: "tenant-1",
      aggregateId: "agg-1",
      evidenceSnapshots: [validSnapshot],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejectionReason).toBe("snapshot_store_required");
    }
  });

  it("persists hashed snapshots and returns refs", async () => {
    const store = new MemorySnapshotStore();
    const result = await commitGovernedEvidenceSnapshots({
      tenantId: "tenant-1",
      aggregateId: "agg-1",
      evidenceSnapshots: [validSnapshot],
      snapshotStore: store,
      createSnapshotId: () => "snap_test_01",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshotIds).toEqual(["snap_test_01"]);
      expect(result.refs.versions).toEqual(LAUNCH_DECISION_RECORD_VERSIONS);
      expect(store.rows[0]?.contentSha256).toBe(
        snapshotContentHash(validSnapshot.values)
      );
    }
  });
});
