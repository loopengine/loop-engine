// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { AuthenticationError, type RuntimeIdentity } from "@loop-engine/auth-iface";
import {
  EntitlementsDeniedError,
  QuotaExceededError,
  assertRuntimeAllowed,
  recordTransitionWithinLimit,
} from "@loop-engine/entitlements-iface";
import type { RunSummary, TraceRecord } from "@loop-engine/observability";
import {
  type RuntimeContext,
  err401,
  err403,
  err404,
  err429,
  err500,
  err503,
  rowToTraceRecord,
  summaryRowToRunSummary,
} from "@loop-engine/runtime-core";

export type RunReadContext = {
  identity: RuntimeIdentity;
  summary: RunSummary;
  trace: TraceRecord[];
};

export type RunReadHandler<TResponse> = (ctx: RunReadContext) => TResponse | Promise<TResponse>;

/**
 * Per-tenant sliding-window state for the in-process rate limiter. Module-scoped
 * so it persists across requests; single-process by design (the hosted runtime
 * swaps in a Redis-backed limiter, see RT-20-design).
 */
const RATE_LIMIT_WINDOWS = new Map<string, number[]>();

/** Test-only escape hatch. */
export function __resetRateLimitWindowsForTests(): void {
  RATE_LIMIT_WINDOWS.clear();
}

/**
 * Shared middleware behind every `/api/v1/runs/{id}/*` route.
 *
 * Steps (RT-01 + RT-05 frozen contract):
 *   1. Gate behind `LOOP_TRACE_ENABLED` — disabled → 503.
 *   2. Authenticate via the injected `AuthAdapter`.
 *   3. Fetch entitlements snapshot + assert tier permits runtime access.
 *   4. Apply quota / rate-limit (best-effort sliding window).
 *   5. Load run summary + trace; 404 if the row doesn't exist for this tenant.
 *   6. Delegate to the route-specific builder.
 *
 * Errors are mapped to the canonical envelope (`{ "error": "..." }`).
 */
export async function withPersistedRunRead(
  ctx: RuntimeContext,
  request: Request,
  runId: string,
  build: RunReadHandler<unknown>,
): Promise<Response> {
  if (!ctx.traceReadEnabled) {
    return err503("Trace API disabled");
  }

  let identity: RuntimeIdentity;
  try {
    identity = await ctx.authAdapter.authenticate(request);
  } catch (err) {
    if (err instanceof AuthenticationError) return err401(err.message);
    return err500("Auth lookup failed");
  }

  let entitlements;
  try {
    entitlements = await ctx.entitlementsAdapter.getEntitlements(identity.tenantId);
  } catch (err) {
    if (err instanceof EntitlementsDeniedError) return err403(err.message);
    return err500("Entitlements lookup failed");
  }

  try {
    assertRuntimeAllowed(entitlements);
  } catch (err) {
    if (err instanceof EntitlementsDeniedError) return err403(err.message);
    return err500("Entitlements check failed");
  }

  try {
    recordTransitionWithinLimit(identity.tenantId, entitlements, RATE_LIMIT_WINDOWS);
  } catch (err) {
    if (err instanceof QuotaExceededError) return err429(err.message);
    return err500("Rate limit check failed");
  }

  const summaryRow = await ctx.traceRepository.getRunSummary(runId, identity.tenantId);
  if (!summaryRow) return err404("Run not found");

  // RT-20-review F-2: trace reads MUST use the authenticated identity tenant.
  // Previously this fetched via a default-tenant `OssPostgresTraceStore` which
  // worked for single-tenant self-host but silently returned the wrong tenant's
  // rows the moment a second API key was issued. Going through `traceRepository`
  // directly forces the tenant scope to match the request identity.
  const traceRows = await ctx.traceRepository.getRunTrace(runId, identity.tenantId);
  const trace: TraceRecord[] = traceRows.map((row) => rowToTraceRecord(row));

  const built = await build({
    identity,
    summary: summaryRowToRunSummary(summaryRow),
    trace,
  });

  return Response.json(built);
}
