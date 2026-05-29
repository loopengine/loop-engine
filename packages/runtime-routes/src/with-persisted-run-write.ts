// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { AuthenticationError, type RuntimeIdentity } from "@loop-engine/auth-iface";
import {
  EntitlementsDeniedError,
  QuotaExceededError,
  assertRuntimeAllowed,
  recordTransitionWithinLimit,
} from "@loop-engine/entitlements-iface";
import type { RuntimeContext } from "@loop-engine/runtime-core";
import { err401, err403, err429, err500 } from "@loop-engine/runtime-core";

/**
 * Per-tenant sliding-window state for the write-side rate limiter. Module-scoped
 * so it persists across requests within a single Next.js process. Cross-process
 * deployments swap in a Redis-backed limiter at the AdapterEntitlements layer.
 *
 * Writes use a SEPARATE window from reads (see `with-persisted-run-read.ts`).
 * RT-20-review entrance criterion E5 recorded the decision: reads keep their
 * own window (count every authed request); writes get a dedicated window so
 * an OSS operator can tune the two independently if needed.
 */
const WRITE_RATE_LIMIT_WINDOWS = new Map<string, number[]>();

/** Test-only escape hatch. */
export function __resetWriteRateLimitWindowsForTests(): void {
  WRITE_RATE_LIMIT_WINDOWS.clear();
}

export type WriteHandlerContext = {
  identity: RuntimeIdentity;
};

export type WriteHandler = (ctx: WriteHandlerContext) => Promise<Response>;

/**
 * Shared write-side middleware. Auth → entitlements → quota → delegate.
 *
 * The handler is responsible for body parsing, route-specific validation, and
 * mapping the runtime-core outcomes (e.g. `outcome: "not_found"`) to HTTP
 * status codes via the `err4xx` / `Response.json` helpers.
 *
 * RT-20-review entrance criteria honored:
 *   - E2 — identity tenant is passed through; runtime-core writes always
 *     scope to `identity.tenantId`.
 *   - E4 — auth → entitlements → quota run in this exact order; no write
 *     handler may skip any of them.
 *   - E5 — writes count against `WRITE_RATE_LIMIT_WINDOWS` (separate from
 *     the read window).
 */
export async function withPersistedRunWrite(
  ctx: RuntimeContext,
  request: Request,
  handler: WriteHandler,
): Promise<Response> {
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
    recordTransitionWithinLimit(identity.tenantId, entitlements, WRITE_RATE_LIMIT_WINDOWS);
  } catch (err) {
    if (err instanceof QuotaExceededError) return err429(err.message);
    return err500("Rate limit check failed");
  }

  return handler({ identity });
}
