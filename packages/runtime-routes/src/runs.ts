// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import {
  type RuntimeContext,
  buildRunDetailResponse,
  buildRunEvidenceResponse,
  buildRunHistoryResponse,
  buildRunReplaySummaryResponse,
  buildRunTimelineResponse,
} from "@loop-engine/runtime-core";

import { withPersistedRunRead } from "./with-persisted-run-read.js";

/**
 * Next.js Route Handler signature for dynamic `[id]` params.
 *
 * Kept loose so this package doesn't have to depend on `next` directly — the
 * OSS app `apps/loop-engine-runtime` does the dependency import.
 */
export type RunRouteHandler = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

/**
 * Factory family for the `/api/v1/runs/{id}/*` frozen read surface.
 *
 * Each factory returns an async handler that:
 *   - awaits the dynamic `{ id }` param (Next 15 contract)
 *   - delegates to {@link withPersistedRunRead} for auth + entitlements + load
 *   - hands the built DTO back as JSON via `Response.json`
 */
export function createRunDetailHandler(ctx: RuntimeContext): RunRouteHandler {
  return async (request, { params }) => {
    const { id } = await params;
    return withPersistedRunRead(ctx, request, id, ({ summary, trace }) =>
      buildRunDetailResponse(summary, trace),
    );
  };
}

export function createRunHistoryHandler(ctx: RuntimeContext): RunRouteHandler {
  return async (request, { params }) => {
    const { id } = await params;
    return withPersistedRunRead(ctx, request, id, ({ summary, trace }) =>
      buildRunHistoryResponse(summary, trace),
    );
  };
}

export function createRunEvidenceHandler(ctx: RuntimeContext): RunRouteHandler {
  return async (request, { params }) => {
    const { id } = await params;
    return withPersistedRunRead(ctx, request, id, ({ summary, trace }) =>
      buildRunEvidenceResponse(summary, trace),
    );
  };
}

export function createRunTimelineHandler(ctx: RuntimeContext): RunRouteHandler {
  return async (request, { params }) => {
    const { id } = await params;
    return withPersistedRunRead(ctx, request, id, ({ summary, trace }) =>
      buildRunTimelineResponse(summary, trace),
    );
  };
}

export function createRunReplaySummaryHandler(ctx: RuntimeContext): RunRouteHandler {
  return async (request, { params }) => {
    const { id } = await params;
    return withPersistedRunRead(ctx, request, id, ({ summary, trace }) =>
      buildRunReplaySummaryResponse(summary, trace),
    );
  };
}
