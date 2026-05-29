// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { randomUUID } from "node:crypto";
import { actorId as toActorId, aggregateId as toAggregateId, loopId as toLoopId, transitionId as toTransitionId } from "@loop-engine/sdk";
import type { RuntimeIdentity } from "@loop-engine/auth-iface";
import type { LoopEngine } from "@loop-engine/runtime";
import type { TraceStore } from "@loop-engine/observability";

import {
  type AppendLoopEventInput,
  type CreateLoopInstanceInput,
  type LoopInstanceRepository,
  LoopInstanceIdempotencyConflictError,
  LoopInstanceUniqueConflictError,
  type PersistedLoopInstance,
} from "./loop-instance-repository.js";
import { createOssTracedLoopSystem } from "./oss-traced-loop-system.js";

/**
 * RT-20c — OSS write surface orchestration.
 *
 * Pure functions that compose a `LoopEngine`, a `TraceStore`, and a
 * `LoopInstanceRepository` into the operations exposed by the write factories
 * in `@loop-engine/runtime-routes`. No HTTP concepts here — the route layer
 * maps the outcomes to status codes.
 *
 * Each function:
 *   - takes a `RuntimeIdentity` so callers always pass the authenticated tenant
 *     (RT-20-review F-2 — no default-tenant binding ever).
 *   - returns a tagged outcome union the route layer translates to a JSON body
 *     and HTTP status.
 */

export type LoopInstanceDto = {
  instanceId: string;
  aggregateId: string;
  loopId: string;
  tenantId: string;
  currentState: string;
  status: string;
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export function toLoopInstanceDto(row: PersistedLoopInstance): LoopInstanceDto {
  return {
    instanceId: row.id,
    aggregateId: row.aggregateId,
    loopId: row.loopId,
    tenantId: row.tenantId,
    currentState: row.currentState,
    status: row.status,
    context:
      row.context && typeof row.context === "object" && !Array.isArray(row.context)
        ? (row.context as Record<string, unknown>)
        : {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// -------------------- POST /api/v1/loops --------------------

export type ProvisionLoopInstanceInput = {
  identity: RuntimeIdentity;
  loopId: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  /** Loop definition resolved by the route layer (registry-fetched or DB-resolved). */
  definition: unknown;
};

export type ProvisionLoopInstanceOutcome =
  | { outcome: "created"; instance: LoopInstanceDto }
  | { outcome: "idempotent_replay"; instance: LoopInstanceDto }
  | { outcome: "invalid_definition"; message: string }
  | { outcome: "conflict"; target: string[] };

export async function provisionOssLoopInstance(
  repo: LoopInstanceRepository,
  input: ProvisionLoopInstanceInput,
): Promise<ProvisionLoopInstanceOutcome> {
  const tenantId = input.identity.tenantId;

  const idempotencyKey = input.idempotencyKey?.trim() || undefined;

  // F-1 path A: pre-check idempotency key before any write. Avoids racing the
  // unique constraint when the row already exists.
  if (idempotencyKey) {
    const existing = await repo.findByIdempotencyKey(tenantId, idempotencyKey);
    if (existing) {
      return { outcome: "idempotent_replay", instance: toLoopInstanceDto(existing) };
    }
  }

  const initialState = parseInitialState(input.definition);
  if (!initialState) {
    return {
      outcome: "invalid_definition",
      message: "Loop definition is missing initial state",
    };
  }

  const createInput: CreateLoopInstanceInput = {
    aggregateId: randomUUID(),
    loopId: input.loopId,
    tenantId,
    idempotencyKey: idempotencyKey ?? null,
    currentState: initialState,
    status: "CREATED",
    context: input.payload as never,
  };

  try {
    const created = await repo.createInstance(createInput);
    return { outcome: "created", instance: toLoopInstanceDto(created) };
  } catch (err) {
    // F-1 path B: lost the race against another concurrent create with the
    // same idempotency key. Re-fetch and return the winner as the idempotent
    // replay outcome.
    if (err instanceof LoopInstanceIdempotencyConflictError && idempotencyKey) {
      const winner = await repo.findByIdempotencyKey(tenantId, idempotencyKey);
      if (winner) {
        return { outcome: "idempotent_replay", instance: toLoopInstanceDto(winner) };
      }
    }
    if (err instanceof LoopInstanceUniqueConflictError) {
      return { outcome: "conflict", target: err.target };
    }
    throw err;
  }
}

// -------------------- POST /api/v1/loops/{id}/start --------------------

export type StartLoopInput = {
  identity: RuntimeIdentity;
  aggregateKey: string;
  engine: LoopEngine;
  traceStore: TraceStore;
  governed?: boolean;
};

export type StartLoopOutcome =
  | { outcome: "started"; instance: { aggregateId: string; currentState: string; status: string } }
  | { outcome: "not_found" }
  | { outcome: "already_started"; status: string };

export async function executeOssStart(
  repo: LoopInstanceRepository,
  input: StartLoopInput,
): Promise<StartLoopOutcome> {
  const existing = await repo.findByAggregateId(input.identity.tenantId, input.aggregateKey);
  if (!existing) return { outcome: "not_found" };
  if (!["CREATED", "PENDING"].includes(existing.status)) {
    return { outcome: "already_started", status: existing.status };
  }

  const tracedEngine = wrapEngine(input.engine, input.traceStore, {
    loopId: existing.loopId,
    tenantId: existing.tenantId,
    governed: input.governed ?? false,
  });

  const started = await tracedEngine.start({
    loopId: toLoopId(existing.loopId),
    aggregateId: toAggregateId(existing.aggregateId),
    actor: { id: toActorId(input.identity.actorId), type: "human" },
    metadata: { tenantId: existing.tenantId },
  });

  const updated = await repo.updateInstanceState({
    tenantId: existing.tenantId,
    id: existing.id,
    currentState: started.currentState,
    status: started.status,
  });

  await repo.appendEvent({
    aggregateId: updated.aggregateId,
    tenantId: updated.tenantId,
    type: "start",
    fromState: existing.currentState,
    toState: updated.currentState,
    actorId: input.identity.actorId,
    actorType: "human",
  });

  return {
    outcome: "started",
    instance: {
      aggregateId: updated.aggregateId,
      currentState: updated.currentState,
      status: updated.status,
    },
  };
}

// -------------------- POST /api/v1/loops/{id}/transition --------------------

export type TransitionActor = { id: string; type: "human" | "ai" | "system" };

export type TransitionLoopInput = {
  identity: RuntimeIdentity;
  aggregateKey: string;
  signalId: string;
  evidence?: Record<string, unknown>;
  actor: TransitionActor;
  engine: LoopEngine;
  traceStore: TraceStore;
  governed?: boolean;
};

export type TransitionLoopOutcome =
  | {
      outcome: "executed";
      result: {
        aggregateId: string;
        previousState: string;
        currentState: string;
        status: string;
        transitionedAtIso: string;
      };
    }
  | { outcome: "not_found" }
  | { outcome: "rejected"; reason: string };

export async function executeOssTransition(
  repo: LoopInstanceRepository,
  input: TransitionLoopInput,
): Promise<TransitionLoopOutcome> {
  const existing = await repo.findByAggregateId(input.identity.tenantId, input.aggregateKey);
  if (!existing) return { outcome: "not_found" };

  const tracedEngine = wrapEngine(input.engine, input.traceStore, {
    loopId: existing.loopId,
    tenantId: existing.tenantId,
    governed: input.governed ?? false,
  });

  const previousState = existing.currentState;
  const cleanedEvidence = sanitizeEvidence(input.evidence);

  const engineActorType =
    input.actor.type === "system" ? "automation" : input.actor.type === "ai" ? "ai-agent" : "human";

  const result = await tracedEngine.transition({
    aggregateId: toAggregateId(existing.aggregateId),
    transitionId: toTransitionId(input.signalId),
    actor: { id: toActorId(input.actor.id), type: engineActorType },
    evidence: cleanedEvidence,
  });

  if (result.status !== "executed" || !result.toState) {
    return {
      outcome: "rejected",
      reason:
        result.rejectionReason ||
        (result.status === "guard_failed" ? "Transition blocked by guard" : "Transition rejected"),
    };
  }

  const updated = await repo.updateInstanceState({
    tenantId: existing.tenantId,
    id: existing.id,
    currentState: result.toState,
    status: result.toState === previousState ? existing.status : "OPEN",
  });

  const loopEventActorType =
    input.actor.type === "system" ? "automation" : input.actor.type === "ai" ? "ai" : "human";

  await repo.appendEvent({
    aggregateId: updated.aggregateId,
    tenantId: updated.tenantId,
    type: input.signalId,
    fromState: previousState,
    toState: updated.currentState,
    actorId: input.actor.id,
    actorType: loopEventActorType,
    evidence: cleanedEvidence as never,
  });

  return {
    outcome: "executed",
    result: {
      aggregateId: updated.aggregateId,
      previousState,
      currentState: updated.currentState,
      status: updated.status,
      transitionedAtIso: updated.updatedAt.toISOString(),
    },
  };
}

// -------------------- POST /api/v1/loops/{id}/cancel --------------------

export type CancelLoopInput = {
  identity: RuntimeIdentity;
  aggregateKey: string;
};

export type CancelLoopOutcome =
  | { outcome: "cancelled"; instance: LoopInstanceDto }
  | { outcome: "not_found" }
  | { outcome: "already_terminal" };

export async function executeOssCancel(
  repo: LoopInstanceRepository,
  input: CancelLoopInput,
): Promise<CancelLoopOutcome> {
  const existing = await repo.findByAggregateId(input.identity.tenantId, input.aggregateKey);
  if (!existing) return { outcome: "not_found" };
  if (existing.status === "TERMINAL") return { outcome: "already_terminal" };

  const fromState = existing.currentState;
  const updated = await repo.updateInstanceState({
    tenantId: existing.tenantId,
    id: existing.id,
    currentState: "CANCELLED",
    status: "TERMINAL",
  });

  await repo.appendEvent({
    aggregateId: existing.aggregateId,
    tenantId: existing.tenantId,
    type: "CANCELLED",
    fromState,
    toState: "CANCELLED",
    actorId: input.identity.actorId,
    actorType: "human",
  });

  return { outcome: "cancelled", instance: toLoopInstanceDto(updated) };
}

// -------------------- internals --------------------

function wrapEngine(
  engine: LoopEngine,
  traceStore: TraceStore,
  config: { loopId: string; tenantId: string; governed: boolean },
): LoopEngine {
  if (process.env.LOOP_TRACE_ENABLED === "false") return engine;
  return createOssTracedLoopSystem(engine, traceStore, config);
}

/**
 * Trim string evidence fields, drop role prefixes, and truncate over-long
 * values. Mirrors the hosted `guardEvidence` shape used in the transition
 * route (`apps/hosted-loops/lib/hosted-loop-transition.ts`).
 */
function sanitizeEvidence(
  evidence: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!evidence) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(evidence)) {
    if (typeof value === "string") {
      const cleaned = value.replace(/^(system|user|assistant|human|ai)\s*:/i, "").trimStart();
      sanitized[key] = cleaned.length > 512 ? `${cleaned.slice(0, 512)} [truncated]` : cleaned;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/** XState-style `states: { [id]: { on?: { [event]: target } } }` — infer entry state. */
function initialStateFromXStateLike(states: Record<string, unknown>): string | null {
  const targets = new Set<string>();
  for (const spec of Object.values(states)) {
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) continue;
    const on = (spec as Record<string, unknown>).on;
    if (on && typeof on === "object" && !Array.isArray(on)) {
      for (const to of Object.values(on)) {
        if (typeof to === "string" && to.trim().length > 0) targets.add(to.trim());
      }
    }
  }
  const keys = Object.keys(states);
  if (keys.includes("idle") && !targets.has("idle")) return "idle";
  for (const k of keys) {
    if (!targets.has(k)) return k;
  }
  return keys[0] ?? null;
}

export function parseInitialState(definition: unknown): string | null {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) return null;
  const obj = definition as Record<string, unknown>;
  if (typeof obj.initialState === "string" && obj.initialState.trim().length > 0) {
    return obj.initialState.trim();
  }
  const states = obj.states;
  if (Array.isArray(states) && states.length > 0) {
    const first = states[0];
    if (typeof first === "string" && first.trim().length > 0) return first.trim();
    if (first && typeof first === "object" && !Array.isArray(first)) {
      const row = first as Record<string, unknown>;
      const sid = row.stateId ?? row.id;
      if (typeof sid === "string" && sid.trim().length > 0) return sid.trim();
    }
  }
  if (states && typeof states === "object" && !Array.isArray(states)) {
    return initialStateFromXStateLike(states as Record<string, unknown>);
  }
  return null;
}
