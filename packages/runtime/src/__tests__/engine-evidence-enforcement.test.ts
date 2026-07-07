// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

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

function governedLoop(): LoopDefinition {
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

const validSnapshot = {
  snapshotKey: "invoice-summary",
  sourceSystem: "snowflake",
  capturedAt: "2026-07-07T12:00:00.000Z",
  capturedBy: "actor-1",
  values: { invoiceNumber: "INV-2026-004521", amount: 12500 },
  versions: LAUNCH_DECISION_RECORD_VERSIONS,
};

describe("LoopEngine governed evidence enforcement", () => {
  it("rejects governed transition without evidence snapshots", async () => {
    const store = new MemoryAdapter();
    const snapshotStore = new MemorySnapshotStore();
    const system = createLoopEngine({
      registry: new MemoryRegistry([governedLoop()]),
      store,
      snapshotStore,
      guardRegistry: new GuardRegistry(),
    });

    await system.start({
      loopId: "governed.invoice",
      aggregateId: "INV-1",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" }),
    });

    const result = await system.transition({
      aggregateId: "INV-1",
      transitionId: "approve",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" }),
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toBe("evidence_required");
    expect(snapshotStore.rows).toHaveLength(0);
  });

  it("commits governed transition with persisted snapshot refs", async () => {
    const store = new MemoryAdapter();
    const snapshotStore = new MemorySnapshotStore();
    const system = createLoopEngine({
      registry: new MemoryRegistry([governedLoop()]),
      store,
      snapshotStore,
      guardRegistry: new GuardRegistry(),
    });

    await system.start({
      loopId: "governed.invoice",
      aggregateId: "INV-2",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" }),
      metadata: { tenantId: "org_demo_alpine" },
    });

    const result = await system.transition({
      aggregateId: "INV-2",
      transitionId: "approve",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" }),
      evidenceSnapshots: [validSnapshot],
    });

    expect(result.status).toBe("executed");
    expect(snapshotStore.rows).toHaveLength(1);
    expect(snapshotStore.rows[0]?.values).toEqual(validSnapshot.values);

    const history = await system.getHistory("INV-2");
    expect(history[0]?.evidence).toMatchObject({
      snapshotIds: [snapshotStore.rows[0]!.id],
      versions: LAUNCH_DECISION_RECORD_VERSIONS,
    });
  });

  it("leaves non-governed transitions on legacy evidence path", async () => {
    const store = new MemoryAdapter();
    const snapshotStore = new MemorySnapshotStore();
    const definition = LoopDefinitionSchema.parse({
      id: "legacy.loop",
      version: "1.0.0",
      name: "Legacy",
      description: "No governed metadata",
      states: [
        { id: "OPEN", label: "Open" },
        { id: "DONE", label: "Done", isTerminal: true },
      ],
      initialState: "OPEN",
      transitions: [
        {
          id: "close",
          from: "OPEN",
          to: "DONE",
          signal: "legacy.close",
          actors: ["human"],
        },
      ],
    });
    const system = createLoopEngine({
      registry: new MemoryRegistry([definition]),
      store,
      snapshotStore,
      guardRegistry: new GuardRegistry(),
    });

    await system.start({
      loopId: "legacy.loop",
      aggregateId: "LEG-1",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" }),
    });

    const result = await system.transition({
      aggregateId: "LEG-1",
      transitionId: "close",
      actor: ActorRefSchema.parse({ id: "user-1", type: "human" }),
      evidence: { note: "legacy-freeform" },
    });

    expect(result.status).toBe("executed");
    expect(snapshotStore.rows).toHaveLength(0);
    const history = await system.getHistory("LEG-1");
    expect(history[0]?.evidence).toMatchObject({ note: "legacy-freeform" });
  });
});
