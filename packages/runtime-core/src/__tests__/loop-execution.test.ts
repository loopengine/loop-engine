// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { describe, expect, it, vi } from "vitest";
import type { RuntimeIdentity } from "@loop-engine/auth-iface";
import type { LoopEngine } from "@loop-engine/runtime";
import type { TraceStore } from "@loop-engine/observability";

import {
  type AppendLoopEventInput,
  type CreateLoopInstanceInput,
  type LoopInstanceRepository,
  type PersistedLoopEvent,
  type PersistedLoopInstance,
  type UpdateLoopInstanceInput,
  LoopInstanceIdempotencyConflictError,
  LoopInstanceUniqueConflictError,
} from "../loop-instance-repository.js";
import {
  executeOssCancel,
  executeOssStart,
  executeOssTransition,
  parseInitialState,
  provisionOssLoopInstance,
} from "../loop-execution.js";
import { __resetOssTraceSequencesForTests } from "../oss-traced-loop-system.js";

const TENANT = "tenant-a";
const OTHER_TENANT = "tenant-b";

const identity = (tenantId = TENANT): RuntimeIdentity => ({
  tenantId,
  apiKeyId: "key-1",
  actorId: "user:demo",
});

function buildInstance(overrides: Partial<PersistedLoopInstance> = {}): PersistedLoopInstance {
  const now = new Date("2026-05-26T12:00:00.000Z");
  return {
    id: "inst-1",
    aggregateId: "agg-1",
    loopId: "loop.demo",
    tenantId: TENANT,
    idempotencyKey: null,
    currentState: "idle",
    status: "CREATED",
    context: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class InMemoryRepo implements LoopInstanceRepository {
  byAggregate = new Map<string, PersistedLoopInstance>();
  byIdempotency = new Map<string, PersistedLoopInstance>();
  events: PersistedLoopEvent[] = [];

  /** When set, the next `createInstance` call throws the supplied error. */
  nextCreateError: Error | null = null;

  async findByAggregateId(tenantId: string, aggregateId: string) {
    const row = this.byAggregate.get(aggregateId);
    if (!row || row.tenantId !== tenantId) return null;
    return row;
  }
  async findByIdempotencyKey(tenantId: string, key: string) {
    return this.byIdempotency.get(`${tenantId}:${key}`) ?? null;
  }
  async createInstance(input: CreateLoopInstanceInput): Promise<PersistedLoopInstance> {
    if (this.nextCreateError) {
      const err = this.nextCreateError;
      this.nextCreateError = null;
      throw err;
    }
    const row = buildInstance({
      id: `inst-${this.byAggregate.size + 1}`,
      aggregateId: input.aggregateId,
      loopId: input.loopId,
      tenantId: input.tenantId,
      idempotencyKey: input.idempotencyKey,
      currentState: input.currentState,
      status: input.status,
      context: input.context as never,
    });
    this.byAggregate.set(input.aggregateId, row);
    if (input.idempotencyKey) {
      this.byIdempotency.set(`${input.tenantId}:${input.idempotencyKey}`, row);
    }
    return row;
  }
  async updateInstanceState(input: UpdateLoopInstanceInput): Promise<PersistedLoopInstance> {
    const row = [...this.byAggregate.values()].find(
      (r) => r.id === input.id && r.tenantId === input.tenantId,
    );
    if (!row) throw new Error("not found");
    const updated: PersistedLoopInstance = {
      ...row,
      currentState: input.currentState,
      status: input.status,
      updatedAt: new Date("2026-05-26T12:00:01.000Z"),
    };
    this.byAggregate.set(row.aggregateId, updated);
    return updated;
  }
  async appendEvent(input: AppendLoopEventInput): Promise<PersistedLoopEvent> {
    const ev: PersistedLoopEvent = {
      id: `ev-${this.events.length + 1}`,
      aggregateId: input.aggregateId,
      tenantId: input.tenantId,
      type: input.type,
      fromState: input.fromState,
      toState: input.toState,
      actorId: input.actorId,
      actorType: input.actorType,
      evidence: (input.evidence ?? null) as never,
      occurredAt: new Date(),
    };
    this.events.push(ev);
    return ev;
  }
}

function makeEngine(behavior: {
  start?: () => Promise<{ currentState: string; status: string }>;
  transition?: () => Promise<{
    status: string;
    toState?: string;
    fromState?: string;
    rejectionReason?: string;
    guardFailures?: Array<{ guardId: string; message: string }>;
  }>;
} = {}): LoopEngine {
  const start =
    behavior.start ?? (async () => ({ currentState: "OPEN", status: "OPEN" }));
  const transition =
    behavior.transition ??
    (async () => ({ status: "executed", toState: "APPROVED", fromState: "OPEN" }));
  return {
    start: vi.fn(start),
    transition: vi.fn(transition),
  } as unknown as LoopEngine;
}

function makeTraceStore(): TraceStore {
  return {
    write: vi.fn().mockResolvedValue(undefined),
  } as unknown as TraceStore;
}

describe("parseInitialState", () => {
  it("returns top-level initialState when present", () => {
    expect(parseInitialState({ initialState: "draft" })).toBe("draft");
  });
  it("infers from XState-like states map", () => {
    expect(parseInitialState({ states: { idle: { on: { go: "active" } }, active: {} } })).toBe(
      "idle",
    );
  });
  it("returns null for nonsense", () => {
    expect(parseInitialState(null)).toBe(null);
    expect(parseInitialState({ states: 42 })).toBe(null);
  });
});

describe("provisionOssLoopInstance — F-1 idempotency", () => {
  it("returns created when no idempotency key", async () => {
    const repo = new InMemoryRepo();
    const outcome = await provisionOssLoopInstance(repo, {
      identity: identity(),
      loopId: "loop.demo",
      payload: { hello: "world" },
      definition: { initialState: "idle" },
    });
    expect(outcome.outcome).toBe("created");
  });

  it("returns idempotent_replay when key already exists (pre-check)", async () => {
    const repo = new InMemoryRepo();
    const existing = buildInstance({ idempotencyKey: "idem-1" });
    repo.byIdempotency.set(`${TENANT}:idem-1`, existing);

    const outcome = await provisionOssLoopInstance(repo, {
      identity: identity(),
      loopId: "loop.demo",
      payload: {},
      idempotencyKey: "idem-1",
      definition: { initialState: "idle" },
    });

    expect(outcome.outcome).toBe("idempotent_replay");
  });

  it("returns idempotent_replay when create races on idempotency unique", async () => {
    const repo = new InMemoryRepo();
    // Simulate: pre-check misses, then create races and loses.
    const winner = buildInstance({ idempotencyKey: "idem-2", aggregateId: "agg-winner" });
    repo.nextCreateError = new LoopInstanceIdempotencyConflictError(TENANT, "idem-2");
    repo.byIdempotency.set(`${TENANT}:idem-2`, winner);

    const outcome = await provisionOssLoopInstance(repo, {
      identity: identity(),
      loopId: "loop.demo",
      payload: {},
      idempotencyKey: "idem-2",
      definition: { initialState: "idle" },
    });

    expect(outcome.outcome).toBe("idempotent_replay");
    if (outcome.outcome === "idempotent_replay") {
      expect(outcome.instance.aggregateId).toBe("agg-winner");
    }
  });

  it("returns conflict for non-idempotency unique violations", async () => {
    const repo = new InMemoryRepo();
    repo.nextCreateError = new LoopInstanceUniqueConflictError(["aggregateId"]);
    const outcome = await provisionOssLoopInstance(repo, {
      identity: identity(),
      loopId: "loop.demo",
      payload: {},
      definition: { initialState: "idle" },
    });
    expect(outcome.outcome).toBe("conflict");
  });

  it("returns invalid_definition when definition lacks initial state", async () => {
    const repo = new InMemoryRepo();
    const outcome = await provisionOssLoopInstance(repo, {
      identity: identity(),
      loopId: "loop.demo",
      payload: {},
      definition: { totallyBroken: true },
    });
    expect(outcome.outcome).toBe("invalid_definition");
  });

  it("never bubbles raw 500 through F-1 collision paths", async () => {
    const repo = new InMemoryRepo();
    // unique conflict path
    repo.nextCreateError = new LoopInstanceUniqueConflictError(["aggregateId"]);
    await expect(
      provisionOssLoopInstance(repo, {
        identity: identity(),
        loopId: "loop.demo",
        payload: {},
        definition: { initialState: "idle" },
      }),
    ).resolves.toMatchObject({ outcome: "conflict" });
  });
});

describe("executeOssStart — F-2 identity tenant guard", () => {
  it("returns not_found when instance belongs to a different tenant", async () => {
    const repo = new InMemoryRepo();
    const otherTenantInstance = buildInstance({ tenantId: OTHER_TENANT });
    repo.byAggregate.set(otherTenantInstance.aggregateId, otherTenantInstance);

    const outcome = await executeOssStart(repo, {
      identity: identity(TENANT),
      aggregateKey: otherTenantInstance.aggregateId,
      engine: makeEngine(),
      traceStore: makeTraceStore(),
    });
    expect(outcome.outcome).toBe("not_found");
  });

  it("returns already_started when status is past CREATED/PENDING", async () => {
    const repo = new InMemoryRepo();
    const inst = buildInstance({ status: "OPEN" });
    repo.byAggregate.set(inst.aggregateId, inst);
    const outcome = await executeOssStart(repo, {
      identity: identity(),
      aggregateKey: inst.aggregateId,
      engine: makeEngine(),
      traceStore: makeTraceStore(),
    });
    expect(outcome.outcome).toBe("already_started");
  });

  it("happy path: starts + appends event + records updated state", async () => {
    __resetOssTraceSequencesForTests();
    const repo = new InMemoryRepo();
    const inst = buildInstance({ status: "CREATED" });
    repo.byAggregate.set(inst.aggregateId, inst);

    const outcome = await executeOssStart(repo, {
      identity: identity(),
      aggregateKey: inst.aggregateId,
      engine: makeEngine(),
      traceStore: makeTraceStore(),
    });
    expect(outcome.outcome).toBe("started");
    expect(repo.events).toHaveLength(1);
    expect(repo.events[0]?.type).toBe("start");
  });
});

describe("executeOssTransition — F-2 identity tenant guard", () => {
  it("returns not_found when instance belongs to a different tenant", async () => {
    const repo = new InMemoryRepo();
    const otherTenantInstance = buildInstance({ tenantId: OTHER_TENANT });
    repo.byAggregate.set(otherTenantInstance.aggregateId, otherTenantInstance);

    const outcome = await executeOssTransition(repo, {
      identity: identity(TENANT),
      aggregateKey: otherTenantInstance.aggregateId,
      signalId: "submit",
      actor: { id: "user:x", type: "human" },
      engine: makeEngine(),
      traceStore: makeTraceStore(),
    });
    expect(outcome.outcome).toBe("not_found");
  });

  it("rejects on engine guard failure with a clear reason", async () => {
    __resetOssTraceSequencesForTests();
    const repo = new InMemoryRepo();
    const inst = buildInstance({ status: "OPEN" });
    repo.byAggregate.set(inst.aggregateId, inst);
    const outcome = await executeOssTransition(repo, {
      identity: identity(),
      aggregateKey: inst.aggregateId,
      signalId: "submit",
      actor: { id: "user:x", type: "human" },
      engine: makeEngine({
        transition: async () => ({
          status: "guard_failed",
          guardFailures: [{ guardId: "g1", message: "denied" }],
        }),
      }),
      traceStore: makeTraceStore(),
    });
    expect(outcome.outcome).toBe("rejected");
    if (outcome.outcome === "rejected") {
      expect(outcome.reason.length).toBeGreaterThan(0);
    }
  });

  it("happy path: executes + appends event with same signalId", async () => {
    __resetOssTraceSequencesForTests();
    const repo = new InMemoryRepo();
    const inst = buildInstance({ status: "OPEN" });
    repo.byAggregate.set(inst.aggregateId, inst);
    const outcome = await executeOssTransition(repo, {
      identity: identity(),
      aggregateKey: inst.aggregateId,
      signalId: "submit",
      evidence: { note: "ok" },
      actor: { id: "user:x", type: "human" },
      engine: makeEngine(),
      traceStore: makeTraceStore(),
    });
    expect(outcome.outcome).toBe("executed");
    expect(repo.events[0]?.type).toBe("submit");
  });
});

describe("executeOssCancel", () => {
  it("returns not_found when instance belongs to a different tenant", async () => {
    const repo = new InMemoryRepo();
    const otherTenantInstance = buildInstance({ tenantId: OTHER_TENANT });
    repo.byAggregate.set(otherTenantInstance.aggregateId, otherTenantInstance);
    const outcome = await executeOssCancel(repo, {
      identity: identity(TENANT),
      aggregateKey: otherTenantInstance.aggregateId,
    });
    expect(outcome.outcome).toBe("not_found");
  });

  it("returns already_terminal for TERMINAL status", async () => {
    const repo = new InMemoryRepo();
    const inst = buildInstance({ status: "TERMINAL", currentState: "DONE" });
    repo.byAggregate.set(inst.aggregateId, inst);
    const outcome = await executeOssCancel(repo, {
      identity: identity(),
      aggregateKey: inst.aggregateId,
    });
    expect(outcome.outcome).toBe("already_terminal");
  });

  it("cancels + appends CANCELLED event", async () => {
    const repo = new InMemoryRepo();
    const inst = buildInstance({ status: "OPEN", currentState: "PENDING" });
    repo.byAggregate.set(inst.aggregateId, inst);
    const outcome = await executeOssCancel(repo, {
      identity: identity(),
      aggregateKey: inst.aggregateId,
    });
    expect(outcome.outcome).toBe("cancelled");
    expect(repo.events.at(-1)?.type).toBe("CANCELLED");
    expect(repo.events.at(-1)?.fromState).toBe("PENDING");
  });
});
