// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * ADR-0004 WP-1 Phase 6 reconstruction tests.
 *
 * Studio audit Phase 6 verdict was **Yes** — a loop without evidence handling
 * could commit a non-defensible record. These tests prove the inverted
 * guarantee on governed paths after engine enforcement lands.
 */

import { describe, expect, it } from "vitest";
import {
  ActorRefSchema,
  LoopDefinitionSchema,
  type AggregateId,
  type LoopDefinition,
  type LoopId,
  type LoopInstance,
  type TransitionRecord,
} from "@loop-engine/core";
import {
  LAUNCH_DECISION_RECORD_VERSIONS,
  snapshotContentHash,
  type EvidenceSnapshotPersisted,
  type SnapshotStore,
} from "@loop-engine/evidence";
import { GuardRegistry } from "@loop-engine/guards";
import { createLoopEngine } from "../engine";
import type { LoopDefinitionRegistry, LoopStore } from "../interfaces";

class MemoryAdapter implements LoopStore {
  loops = new Map<AggregateId, LoopInstance>();
  transitions = new Map<AggregateId, TransitionRecord[]>();

  async getInstance(aggregateId: AggregateId): Promise<LoopInstance | null> {
    return this.loops.get(aggregateId) ?? null;
  }

  async saveInstance(instance: LoopInstance): Promise<void> {
    this.loops.set(instance.aggregateId, instance);
  }

  async saveTransitionRecord(record: TransitionRecord): Promise<void> {
    const current = this.transitions.get(record.aggregateId) ?? [];
    current.push(record);
    this.transitions.set(record.aggregateId, current);
  }

  async getTransitionHistory(aggregateId: AggregateId): Promise<TransitionRecord[]> {
    return this.transitions.get(aggregateId) ?? [];
  }

  async listOpenInstances(loopId: LoopId): Promise<LoopInstance[]> {
    return [...this.loops.values()].filter(
      (instance) => instance.loopId === loopId && instance.status === "active"
    );
  }
}

class MemoryRegistry implements LoopDefinitionRegistry {
  constructor(private readonly defs: LoopDefinition[]) {}

  get(id: LoopId): LoopDefinition | undefined {
    return this.defs.find((d) => d.id === id);
  }

  list(): LoopDefinition[] {
    return this.defs;
  }
}

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

const humanActor = ActorRefSchema.parse({ id: "user-1", type: "human" });

/** Golden exemplar semantic payload (INV-2026-004521). */
const goldenSnapshotValues = {
  invoiceNumber: "INV-2026-004521",
  amount: 12500,
  currency: "USD",
  vendor: "Alpine Components",
};

const goldenSnapshot = {
  snapshotKey: "invoice-summary",
  sourceSystem: "snowflake",
  sourceRef: "sf://alpine/invoice_total",
  capturedAt: "2026-07-07T12:00:00.000Z",
  capturedBy: "actor-1",
  values: goldenSnapshotValues,
  versions: LAUNCH_DECISION_RECORD_VERSIONS,
};

function governedTransitionLoop(): LoopDefinition {
  return LoopDefinitionSchema.parse({
    id: "governed.invoice",
    version: "1.0.0",
    name: "Governed Invoice",
    description: "Invoice approval with governed evidence",
    states: [
      { id: "OPEN", label: "Open" },
      { id: "APPROVED", label: "Approved", isTerminal: true },
    ],
    initialState: "OPEN",
    transitions: [
      {
        id: "approve",
        from: "OPEN",
        to: "APPROVED",
        signal: "invoice.approve",
        actors: ["human"],
        metadata: { governedEvidence: true },
      },
    ],
  });
}

function governedLoopLevel(): LoopDefinition {
  return LoopDefinitionSchema.parse({
    id: "governed.loop-level",
    version: "1.0.0",
    name: "Loop-level governed",
    description: "governedEvidence on loop metadata",
    metadata: { governedEvidence: true },
    states: [
      { id: "OPEN", label: "Open" },
      { id: "DONE", label: "Done", isTerminal: true },
    ],
    initialState: "OPEN",
    transitions: [
      {
        id: "finish",
        from: "OPEN",
        to: "DONE",
        signal: "loop.finish",
        actors: ["human"],
      },
    ],
  });
}

/** Audit-style loop: no guards, no governed metadata — permissive OSS path. */
function auditStyleLoop(): LoopDefinition {
  return LoopDefinitionSchema.parse({
    id: "audit.demo",
    version: "1.0.0",
    name: "Audit Demo",
    description: "Minimal loop from studio audit Phase 6",
    states: [
      { id: "A", label: "A" },
      { id: "B", label: "B", isTerminal: true },
    ],
    initialState: "A",
    transitions: [
      {
        id: "go",
        from: "A",
        to: "B",
        signal: "go",
        actors: ["human"],
      },
    ],
  });
}

function createHarness(definition: LoopDefinition, snapshotStore?: SnapshotStore) {
  const store = new MemoryAdapter();
  const system = createLoopEngine({
    registry: new MemoryRegistry([definition]),
    store,
    ...(snapshotStore ? { snapshotStore } : {}),
    guardRegistry: new GuardRegistry(),
  });
  return { store, system, snapshotStore };
}

describe("Phase 6 reconstruction (ADR-0004)", () => {
  it("inverts audit verdict: governed transition rejects freeform evidence only", async () => {
    const { system, snapshotStore } = createHarness(
      governedTransitionLoop(),
      new MemorySnapshotStore()
    );

    await system.start({
      loopId: "governed.invoice",
      aggregateId: "INV-PH6-1",
      actor: humanActor,
    });

    const result = await system.transition({
      aggregateId: "INV-PH6-1",
      transitionId: "approve",
      actor: humanActor,
      evidence: { note: "approved because I said so" },
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toBe("evidence_required");
    expect(snapshotStore?.rows).toHaveLength(0);

    const instance = await system.getState("INV-PH6-1");
    expect(instance?.currentState).toBe("OPEN");
    expect(instance?.status).toBe("active");
    expect(await system.getHistory("INV-PH6-1")).toHaveLength(0);
  });

  it("rejects loop-level governedEvidence without snapshots", async () => {
    const { system } = createHarness(governedLoopLevel(), new MemorySnapshotStore());

    await system.start({
      loopId: "governed.loop-level",
      aggregateId: "LOOP-PH6-1",
      actor: humanActor,
    });

    const result = await system.transition({
      aggregateId: "LOOP-PH6-1",
      transitionId: "finish",
      actor: humanActor,
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toBe("evidence_required");
  });

  it("rejects invalid snapshot structure before state commit", async () => {
    const { system, snapshotStore } = createHarness(
      governedTransitionLoop(),
      new MemorySnapshotStore()
    );

    await system.start({
      loopId: "governed.invoice",
      aggregateId: "INV-PH6-2",
      actor: humanActor,
    });

    const result = await system.transition({
      aggregateId: "INV-PH6-2",
      transitionId: "approve",
      actor: humanActor,
      evidenceSnapshots: [{ snapshotKey: "incomplete" }],
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toBe("invalid_evidence_snapshot");
    expect(snapshotStore?.rows).toHaveLength(0);
    expect((await system.getState("INV-PH6-2"))?.currentState).toBe("OPEN");
  });

  it("rejects contentSha256 mismatch before state commit", async () => {
    const { system, snapshotStore } = createHarness(
      governedTransitionLoop(),
      new MemorySnapshotStore()
    );

    await system.start({
      loopId: "governed.invoice",
      aggregateId: "INV-PH6-3",
      actor: humanActor,
    });

    const result = await system.transition({
      aggregateId: "INV-PH6-3",
      transitionId: "approve",
      actor: humanActor,
      evidenceSnapshots: [
        {
          ...goldenSnapshot,
          contentSha256: "f".repeat(64),
        },
      ],
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toBe("invalid_evidence_snapshot");
    expect(snapshotStore?.rows).toHaveLength(0);
  });

  it("requires SnapshotStore when snapshots are otherwise valid", async () => {
    const { system } = createHarness(governedTransitionLoop());

    await system.start({
      loopId: "governed.invoice",
      aggregateId: "INV-PH6-4",
      actor: humanActor,
    });

    const result = await system.transition({
      aggregateId: "INV-PH6-4",
      transitionId: "approve",
      actor: humanActor,
      evidenceSnapshots: [goldenSnapshot],
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toBe("snapshot_store_required");
  });

  it("golden path commits frozen snapshot refs and semantic hash", async () => {
    const snapshotStore = new MemorySnapshotStore();
    const { system } = createHarness(governedTransitionLoop(), snapshotStore);
    const expectedHash = snapshotContentHash(goldenSnapshotValues);

    await system.start({
      loopId: "governed.invoice",
      aggregateId: "INV-2026-004521",
      actor: humanActor,
      metadata: { tenantId: "org_demo_alpine" },
    });

    const result = await system.transition({
      aggregateId: "INV-2026-004521",
      transitionId: "approve",
      actor: humanActor,
      evidenceSnapshots: [goldenSnapshot],
      tenantId: "org_demo_alpine",
    });

    expect(result.status).toBe("executed");
    expect(result.toState).toBe("APPROVED");
    expect(snapshotStore.rows).toHaveLength(1);
    expect(snapshotStore.rows[0]?.contentSha256).toBe(expectedHash);
    expect(snapshotStore.rows[0]?.values).toEqual(goldenSnapshotValues);

    const history = await system.getHistory("INV-2026-004521");
    expect(history).toHaveLength(1);
    expect(history[0]?.evidence).toMatchObject({
      snapshotIds: [snapshotStore.rows[0]!.id],
      versions: LAUNCH_DECISION_RECORD_VERSIONS,
    });
    expect(history[0]?.evidence).not.toHaveProperty("note");
  });
});

describe("LoopEngine governed evidence enforcement", () => {
  it("rejects governed transition without evidence snapshots", async () => {
    const { system, snapshotStore } = createHarness(
      governedTransitionLoop(),
      new MemorySnapshotStore()
    );

    await system.start({
      loopId: "governed.invoice",
      aggregateId: "INV-1",
      actor: humanActor,
    });

    const result = await system.transition({
      aggregateId: "INV-1",
      transitionId: "approve",
      actor: humanActor,
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toBe("evidence_required");
    expect(snapshotStore?.rows).toHaveLength(0);
  });

  it("commits governed transition with persisted snapshot refs", async () => {
    const snapshotStore = new MemorySnapshotStore();
    const { system } = createHarness(governedTransitionLoop(), snapshotStore);

    await system.start({
      loopId: "governed.invoice",
      aggregateId: "INV-2",
      actor: humanActor,
      metadata: { tenantId: "org_demo_alpine" },
    });

    const result = await system.transition({
      aggregateId: "INV-2",
      transitionId: "approve",
      actor: humanActor,
      evidenceSnapshots: [goldenSnapshot],
    });

    expect(result.status).toBe("executed");
    expect(snapshotStore.rows).toHaveLength(1);
    expect(snapshotStore.rows[0]?.values).toEqual(goldenSnapshotValues);

    const history = await system.getHistory("INV-2");
    expect(history[0]?.evidence).toMatchObject({
      snapshotIds: [snapshotStore.rows[0]!.id],
      versions: LAUNCH_DECISION_RECORD_VERSIONS,
    });
  });

  it("leaves non-governed transitions on legacy evidence path", async () => {
    const snapshotStore = new MemorySnapshotStore();
    const { system } = createHarness(auditStyleLoop(), snapshotStore);

    await system.start({
      loopId: "audit.demo",
      aggregateId: "LEG-1",
      actor: humanActor,
    });

    const result = await system.transition({
      aggregateId: "LEG-1",
      transitionId: "go",
      actor: humanActor,
      evidence: { note: "legacy-freeform" },
    });

    expect(result.status).toBe("executed");
    expect(snapshotStore.rows).toHaveLength(0);
    const history = await system.getHistory("LEG-1");
    expect(history[0]?.evidence).toMatchObject({ note: "legacy-freeform" });
  });

  it("audit-style loop without governed metadata can still commit freeform evidence", async () => {
    const snapshotStore = new MemorySnapshotStore();
    const { system } = createHarness(auditStyleLoop(), snapshotStore);

    await system.start({
      loopId: "audit.demo",
      aggregateId: "AUDIT-1",
      actor: humanActor,
    });

    const result = await system.transition({
      aggregateId: "AUDIT-1",
      transitionId: "go",
      actor: humanActor,
      evidence: { note: "approved because I said so" },
    });

    expect(result.status).toBe("executed");
    expect(snapshotStore.rows).toHaveLength(0);
    expect((await system.getHistory("AUDIT-1"))[0]?.evidence).toEqual({
      note: "approved because I said so",
    });
  });
});
