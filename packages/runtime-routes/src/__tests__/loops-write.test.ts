// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryAuthAdapter } from "@loop-engine/auth-iface";
import { MemoryEntitlementsAdapter } from "@loop-engine/entitlements-iface";
import type { LoopEngine } from "@loop-engine/runtime";
import type { TraceStore } from "@loop-engine/observability";
import {
  type AppendLoopEventInput,
  type CreateLoopInstanceInput,
  type LoopInstanceRepository,
  type PersistedLoopEvent,
  type PersistedLoopInstance,
  type PersistedTraceRow,
  type TraceReadRepository,
  type UpdateLoopInstanceInput,
} from "@loop-engine/runtime-core";

import {
  __resetWriteRateLimitWindowsForTests,
  createLoopCancelHandler,
  createLoopCreateHandler,
  createLoopStartHandler,
  createLoopTransitionHandler,
  type WriteRuntimeContext,
} from "../index.js";

const DEMO_TENANT = "self-host-tenant";
const DEMO_API_KEY = "le_5e1f0057de51f057de51f057de51f001";

afterEach(() => {
  __resetWriteRateLimitWindowsForTests();
});

class InMemoryLoopInstances implements LoopInstanceRepository {
  byAggregate = new Map<string, PersistedLoopInstance>();
  byIdempotency = new Map<string, PersistedLoopInstance>();
  events: PersistedLoopEvent[] = [];

  async findByAggregateId(tenantId: string, aggregateId: string) {
    const row = this.byAggregate.get(aggregateId);
    if (!row || row.tenantId !== tenantId) return null;
    return row;
  }
  async findByIdempotencyKey(tenantId: string, key: string) {
    return this.byIdempotency.get(`${tenantId}:${key}`) ?? null;
  }
  async createInstance(input: CreateLoopInstanceInput) {
    const row: PersistedLoopInstance = {
      id: `inst-${this.byAggregate.size + 1}`,
      aggregateId: input.aggregateId,
      loopId: input.loopId,
      tenantId: input.tenantId,
      idempotencyKey: input.idempotencyKey,
      currentState: input.currentState,
      status: input.status,
      context: input.context as never,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.byAggregate.set(input.aggregateId, row);
    if (input.idempotencyKey) {
      this.byIdempotency.set(`${input.tenantId}:${input.idempotencyKey}`, row);
    }
    return row;
  }
  async updateInstanceState(input: UpdateLoopInstanceInput) {
    const row = [...this.byAggregate.values()].find(
      (r) => r.id === input.id && r.tenantId === input.tenantId,
    );
    if (!row) throw new Error("missing");
    const updated: PersistedLoopInstance = {
      ...row,
      currentState: input.currentState,
      status: input.status,
      updatedAt: new Date(),
    };
    this.byAggregate.set(row.aggregateId, updated);
    return updated;
  }
  async appendEvent(input: AppendLoopEventInput) {
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

class InMemoryTraceReadRepository implements TraceReadRepository {
  async getRunSummary() {
    return null;
  }
  async getRunTrace(): Promise<PersistedTraceRow[]> {
    return [];
  }
}

function makeEngine(): LoopEngine {
  return {
    start: vi.fn(async () => ({ currentState: "OPEN", status: "OPEN" })),
    transition: vi.fn(async () => ({
      status: "executed",
      toState: "APPROVED",
      fromState: "OPEN",
    })),
  } as unknown as LoopEngine;
}

function makeTraceStore(): TraceStore {
  return { write: vi.fn().mockResolvedValue(undefined) } as unknown as TraceStore;
}

function buildWriteContext(
  opts: { resolveLoopDefinition?: WriteRuntimeContext["resolveLoopDefinition"] } = {},
): { ctx: WriteRuntimeContext; repo: InMemoryLoopInstances } {
  const repo = new InMemoryLoopInstances();
  const ctx: WriteRuntimeContext = {
    authAdapter: new MemoryAuthAdapter([
      { token: DEMO_API_KEY, tenantId: DEMO_TENANT, apiKeyId: "key-1" },
    ]),
    entitlementsAdapter: new MemoryEntitlementsAdapter({ tier: 1 }),
    traceRepository: new InMemoryTraceReadRepository(),
    traceReadEnabled: true,
    loopInstanceRepository: repo,
    engineForTenant: async () => makeEngine(),
    traceStoreForTenant: () => makeTraceStore(),
    resolveLoopDefinition:
      opts.resolveLoopDefinition ??
      (async () => ({ definition: { initialState: "idle" } })),
  };
  return { ctx, repo };
}

function authed(path: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost:3012${path}`, {
    method: "POST",
    ...init,
    headers: {
      Authorization: `Bearer ${DEMO_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function paramsOf(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("createLoopCreateHandler — auth + idempotency", () => {
  it("401 when missing Authorization", async () => {
    const { ctx } = buildWriteContext();
    const handler = createLoopCreateHandler(ctx);
    const req = new Request("http://localhost:3012/api/v1/loops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loopId: "loop.demo", payload: {} }),
    });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it("422 when body is invalid", async () => {
    const { ctx } = buildWriteContext();
    const handler = createLoopCreateHandler(ctx);
    const res = await handler(authed("/api/v1/loops", { body: JSON.stringify({}) }));
    expect(res.status).toBe(422);
  });

  it("404 when loop definition is missing", async () => {
    const { ctx } = buildWriteContext({ resolveLoopDefinition: async () => null });
    const handler = createLoopCreateHandler(ctx);
    const res = await handler(
      authed("/api/v1/loops", { body: JSON.stringify({ loopId: "missing", payload: {} }) }),
    );
    expect(res.status).toBe(404);
  });

  it("201 on first create, 200 echo on second with same idempotency key", async () => {
    const { ctx } = buildWriteContext();
    const handler = createLoopCreateHandler(ctx);
    const body = JSON.stringify({
      loopId: "loop.demo",
      payload: { hello: "world" },
      idempotencyKey: "idem-abc",
    });
    const res1 = await handler(authed("/api/v1/loops", { body }));
    expect(res1.status).toBe(201);
    const first = (await res1.json()) as { aggregateId: string };

    const res2 = await handler(authed("/api/v1/loops", { body }));
    expect(res2.status).toBe(200);
    const second = (await res2.json()) as { aggregateId: string; idempotent: boolean };
    expect(second.idempotent).toBe(true);
    expect(second.aggregateId).toBe(first.aggregateId);
  });
});

describe("createLoopStartHandler — 404 / 409 / 200", () => {
  it("404 when instance doesn't exist", async () => {
    const { ctx } = buildWriteContext();
    const handler = createLoopStartHandler(ctx);
    const res = await handler(authed("/api/v1/loops/missing/start"), paramsOf("missing"));
    expect(res.status).toBe(404);
  });

  it("409 when status is already past CREATED/PENDING", async () => {
    const { ctx, repo } = buildWriteContext();
    repo.byAggregate.set("agg-1", {
      id: "inst-1",
      aggregateId: "agg-1",
      loopId: "loop.demo",
      tenantId: DEMO_TENANT,
      idempotencyKey: null,
      currentState: "idle",
      status: "OPEN",
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const handler = createLoopStartHandler(ctx);
    const res = await handler(authed("/api/v1/loops/agg-1/start"), paramsOf("agg-1"));
    expect(res.status).toBe(409);
  });

  it("200 on happy path", async () => {
    const { ctx, repo } = buildWriteContext();
    repo.byAggregate.set("agg-1", {
      id: "inst-1",
      aggregateId: "agg-1",
      loopId: "loop.demo",
      tenantId: DEMO_TENANT,
      idempotencyKey: null,
      currentState: "idle",
      status: "CREATED",
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const handler = createLoopStartHandler(ctx);
    const res = await handler(authed("/api/v1/loops/agg-1/start"), paramsOf("agg-1"));
    expect(res.status).toBe(200);
  });
});

describe("createLoopTransitionHandler — 422 + 200", () => {
  it("422 when signalId is missing", async () => {
    const { ctx } = buildWriteContext();
    const handler = createLoopTransitionHandler(ctx);
    const res = await handler(
      authed("/api/v1/loops/agg-1/transition", {
        body: JSON.stringify({ actor: { id: "u", type: "human" } }),
      }),
      paramsOf("agg-1"),
    );
    expect(res.status).toBe(422);
  });

  it("422 when actor.type is invalid", async () => {
    const { ctx } = buildWriteContext();
    const handler = createLoopTransitionHandler(ctx);
    const res = await handler(
      authed("/api/v1/loops/agg-1/transition", {
        body: JSON.stringify({ signalId: "submit", actor: { id: "u", type: "robot" } }),
      }),
      paramsOf("agg-1"),
    );
    expect(res.status).toBe(422);
  });

  it("200 on happy path", async () => {
    const { ctx, repo } = buildWriteContext();
    repo.byAggregate.set("agg-1", {
      id: "inst-1",
      aggregateId: "agg-1",
      loopId: "loop.demo",
      tenantId: DEMO_TENANT,
      idempotencyKey: null,
      currentState: "OPEN",
      status: "OPEN",
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const handler = createLoopTransitionHandler(ctx);
    const res = await handler(
      authed("/api/v1/loops/agg-1/transition", {
        body: JSON.stringify({ signalId: "submit", actor: { id: "u", type: "human" } }),
      }),
      paramsOf("agg-1"),
    );
    expect(res.status).toBe(200);
  });
});

describe("createLoopCancelHandler — 404 / 409 / 200", () => {
  it("404 when missing", async () => {
    const { ctx } = buildWriteContext();
    const handler = createLoopCancelHandler(ctx);
    const res = await handler(authed("/api/v1/loops/missing/cancel"), paramsOf("missing"));
    expect(res.status).toBe(404);
  });

  it("409 when already terminal", async () => {
    const { ctx, repo } = buildWriteContext();
    repo.byAggregate.set("agg-1", {
      id: "inst-1",
      aggregateId: "agg-1",
      loopId: "loop.demo",
      tenantId: DEMO_TENANT,
      idempotencyKey: null,
      currentState: "DONE",
      status: "TERMINAL",
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const handler = createLoopCancelHandler(ctx);
    const res = await handler(authed("/api/v1/loops/agg-1/cancel"), paramsOf("agg-1"));
    expect(res.status).toBe(409);
  });

  it("200 on happy path", async () => {
    const { ctx, repo } = buildWriteContext();
    repo.byAggregate.set("agg-1", {
      id: "inst-1",
      aggregateId: "agg-1",
      loopId: "loop.demo",
      tenantId: DEMO_TENANT,
      idempotencyKey: null,
      currentState: "OPEN",
      status: "OPEN",
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const handler = createLoopCancelHandler(ctx);
    const res = await handler(authed("/api/v1/loops/agg-1/cancel"), paramsOf("agg-1"));
    expect(res.status).toBe(200);
  });
});

describe("write-side cross-tenant isolation (RT-20-review F-2)", () => {
  it("returns 404 when another tenant's API key tries to start an instance", async () => {
    const { ctx, repo } = buildWriteContext();
    // Existing tenant adapter only knows DEMO_TENANT — issue a second key for a different tenant.
    const OTHER_API_KEY = "le_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const adapter = new MemoryAuthAdapter([
      { token: DEMO_API_KEY, tenantId: DEMO_TENANT, apiKeyId: "key-1" },
      { token: OTHER_API_KEY, tenantId: "other-tenant", apiKeyId: "key-2" },
    ]);
    ctx.authAdapter = adapter;

    repo.byAggregate.set("agg-shared", {
      id: "inst-x",
      aggregateId: "agg-shared",
      loopId: "loop.demo",
      tenantId: DEMO_TENANT,
      idempotencyKey: null,
      currentState: "idle",
      status: "CREATED",
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const handler = createLoopStartHandler(ctx);
    const req = new Request("http://localhost:3012/api/v1/loops/agg-shared/start", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OTHER_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const res = await handler(req, paramsOf("agg-shared"));
    expect(res.status).toBe(404);
  });
});
