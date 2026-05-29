// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import type { RuntimeIdentity } from "@loop-engine/auth-iface";
import type { LoopEngine } from "@loop-engine/runtime";
import type { TraceStore } from "@loop-engine/observability";
import {
  type LoopInstanceRepository,
  type RuntimeContext,
  err404,
  err409,
  err422,
  err500,
  executeOssCancel,
  executeOssStart,
  executeOssTransition,
  provisionOssLoopInstance,
} from "@loop-engine/runtime-core";

import { withPersistedRunWrite } from "./with-persisted-run-write.js";

/**
 * Resolve the loop definition the runtime should run for a given tenant. The
 * OSS app may resolve from the registry-loop service, from a local Postgres
 * `LoopDefinition` row, or from a static map. Returning `null` triggers a 404
 * from the create handler.
 */
export type ResolveLoopDefinitionFn = (params: {
  tenantId: string;
  loopId: string;
  identity: RuntimeIdentity;
}) => Promise<{ definition: unknown } | null>;

/**
 * Extended context the write factories consume. Composes the read-side
 * `RuntimeContext` (auth + entitlements + trace repo + trace gate) with the
 * write-side dependencies (loop instance repo + per-tenant engine/trace store
 * providers + definition resolver).
 *
 * RT-20-review F-2: `engineForTenant` and `traceStoreForTenant` MUST construct
 * per-tenant artifacts bound to the *requested* tenant. Never reuse a default
 * store across tenants.
 */
export interface WriteRuntimeContext extends RuntimeContext {
  loopInstanceRepository: LoopInstanceRepository;
  engineForTenant: (tenantId: string) => Promise<LoopEngine>;
  traceStoreForTenant: (tenantId: string) => TraceStore;
  resolveLoopDefinition: ResolveLoopDefinitionFn;
}

/** Next.js Route Handler signature for dynamic `[id]` params (POST writes). */
export type LoopWriteRouteHandler = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

/** POST /api/v1/loops — no dynamic id. */
export type LoopCreateRouteHandler = (request: Request) => Promise<Response>;

type SubmitLoopBody = {
  loopId: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

type TransitionBody = {
  signalId: string;
  evidence?: Record<string, unknown>;
  actor: { id: string; type: "human" | "ai" | "system" };
};

// -------------------- POST /api/v1/loops --------------------

export function createLoopCreateHandler(ctx: WriteRuntimeContext): LoopCreateRouteHandler {
  return async (request) =>
    withPersistedRunWrite(ctx, request, async ({ identity }) => {
      let body: Partial<SubmitLoopBody>;
      try {
        body = (await request.json()) as Partial<SubmitLoopBody>;
      } catch {
        return err422("Invalid JSON body");
      }

      if (typeof body.loopId !== "string" || body.loopId.trim().length === 0) {
        return err422("Invalid request body", { loopId: "loopId must be a non-empty string" });
      }
      if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
        return err422("Invalid request body", { payload: "payload must be an object" });
      }
      if (body.idempotencyKey !== undefined && typeof body.idempotencyKey !== "string") {
        return err422("Invalid request body", {
          idempotencyKey: "idempotencyKey must be a string",
        });
      }
      if (
        body.metadata !== undefined &&
        (!body.metadata || typeof body.metadata !== "object" || Array.isArray(body.metadata))
      ) {
        return err422("Invalid request body", { metadata: "metadata must be an object" });
      }

      const loopId = body.loopId.trim();

      const resolved = await ctx.resolveLoopDefinition({
        tenantId: identity.tenantId,
        loopId,
        identity,
      });
      if (!resolved) return err404("Loop definition not found");

      const outcome = await provisionOssLoopInstance(ctx.loopInstanceRepository, {
        identity,
        loopId,
        payload: body.payload,
        idempotencyKey: body.idempotencyKey,
        definition: resolved.definition,
      });

      switch (outcome.outcome) {
        case "created":
          return Response.json(outcome.instance, { status: 201 });
        case "idempotent_replay":
          return Response.json(
            { ...outcome.instance, idempotent: true },
            { status: 200 },
          );
        case "invalid_definition":
          return err500(outcome.message);
        case "conflict":
          return err409(`Loop instance conflict on: ${outcome.target.join(", ")}`);
      }
    });
}

// -------------------- POST /api/v1/loops/{id}/start --------------------

export function createLoopStartHandler(ctx: WriteRuntimeContext): LoopWriteRouteHandler {
  return async (request, { params }) => {
    const { id } = await params;
    return withPersistedRunWrite(ctx, request, async ({ identity }) => {
      const existing = await ctx.loopInstanceRepository.findByAggregateId(
        identity.tenantId,
        id,
      );
      if (!existing) return err404("Loop not found");

      const engine = await ctx.engineForTenant(identity.tenantId);
      const traceStore = ctx.traceStoreForTenant(identity.tenantId);
      const outcome = await executeOssStart(ctx.loopInstanceRepository, {
        identity,
        aggregateKey: id,
        engine,
        traceStore,
      });
      switch (outcome.outcome) {
        case "started":
          return Response.json(outcome.instance, { status: 200 });
        case "not_found":
          return err404("Loop not found");
        case "already_started":
          return err409(`Loop already started (status: ${outcome.status})`);
      }
    });
  };
}

// -------------------- POST /api/v1/loops/{id}/transition --------------------

export function createLoopTransitionHandler(ctx: WriteRuntimeContext): LoopWriteRouteHandler {
  return async (request, { params }) => {
    const { id } = await params;
    return withPersistedRunWrite(ctx, request, async ({ identity }) => {
      let body: Partial<TransitionBody>;
      try {
        body = (await request.json()) as Partial<TransitionBody>;
      } catch {
        return err422("Invalid JSON body");
      }

      if (typeof body.signalId !== "string" || body.signalId.trim().length === 0) {
        return err422("Invalid request body", { signalId: "signalId is required" });
      }
      if (!body.actor || typeof body.actor !== "object" || Array.isArray(body.actor)) {
        return err422("Invalid request body", { actor: "actor is required" });
      }
      if (typeof body.actor.id !== "string" || body.actor.id.trim().length === 0) {
        return err422("Invalid request body", { "actor.id": "actor.id is required" });
      }
      if (!["human", "ai", "system"].includes(body.actor.type as string)) {
        return err422("Invalid request body", { "actor.type": "actor.type must be human|ai|system" });
      }
      if (
        body.evidence !== undefined &&
        (!body.evidence || typeof body.evidence !== "object" || Array.isArray(body.evidence))
      ) {
        return err422("Invalid request body", { evidence: "evidence must be an object" });
      }

      const existing = await ctx.loopInstanceRepository.findByAggregateId(
        identity.tenantId,
        id,
      );
      if (!existing) return err404("Loop not found");

      const engine = await ctx.engineForTenant(identity.tenantId);
      const traceStore = ctx.traceStoreForTenant(identity.tenantId);

      const outcome = await executeOssTransition(ctx.loopInstanceRepository, {
        identity,
        aggregateKey: id,
        signalId: body.signalId.trim(),
        evidence: body.evidence,
        actor: body.actor as TransitionBody["actor"],
        engine,
        traceStore,
      });

      switch (outcome.outcome) {
        case "executed":
          return Response.json(outcome.result, { status: 200 });
        case "not_found":
          return err404("Loop not found");
        case "rejected":
          return err409(outcome.reason);
      }
    });
  };
}

// -------------------- POST /api/v1/loops/{id}/cancel --------------------

export function createLoopCancelHandler(ctx: WriteRuntimeContext): LoopWriteRouteHandler {
  return async (request, { params }) => {
    const { id } = await params;
    return withPersistedRunWrite(ctx, request, async ({ identity }) => {
      const outcome = await executeOssCancel(ctx.loopInstanceRepository, {
        identity,
        aggregateKey: id,
      });
      switch (outcome.outcome) {
        case "cancelled":
          return Response.json(outcome.instance, { status: 200 });
        case "not_found":
          return err404("Loop not found");
        case "already_terminal":
          return err409("Loop instance is already terminal");
      }
    });
  };
}
