// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import {
  type EntitlementsSnapshot,
  EntitlementsDeniedError,
  QuotaExceededError,
} from "./types.js";

/**
 * Asserts the tenant is allowed to invoke the runtime at all. OSS callers pass
 * the snapshot returned by `MemoryEntitlementsAdapter` (tier 1 by default);
 * proprietary callers pass their hosted entitlements snapshot.
 */
export function assertRuntimeAllowed(snapshot: EntitlementsSnapshot): void {
  if (snapshot.tier <= 0) {
    throw new EntitlementsDeniedError(
      `Tenant ${snapshot.organizationId} has tier ${snapshot.tier}; runtime access requires tier >= 1.`,
    );
  }
}

/**
 * Per-tier transition rate limit (transitions per 60-second sliding window).
 * Mirrors the cloud tier ladder so a tenant moving from self-host to hosted
 * doesn't see a behavior change at the same tier.
 */
export function transitionsPerMinuteForTier(tier: number): number {
  if (tier >= 3) return 1000;
  if (tier === 2) return 300;
  return 60;
}

/**
 * Simple in-process sliding-window rate limiter. State lives in the supplied
 * `windows` map so callers can choose Map / LRU / external store. Throws
 * `QuotaExceededError` when the limit is exceeded; otherwise records the hit.
 *
 * Not redistributed across replicas — fine for self-host single-process; the
 * hosted runtime swaps in a Redis-backed limiter via its own helper.
 */
export function recordTransitionWithinLimit(
  tenantId: string,
  snapshot: EntitlementsSnapshot,
  windows: Map<string, number[]>,
  now: number = Date.now(),
): void {
  const limit = transitionsPerMinuteForTier(snapshot.tier);
  const windowStart = now - 60_000;
  const entries = windows.get(tenantId) ?? [];
  const filtered = entries.filter((ts) => ts >= windowStart);
  if (filtered.length >= limit) {
    windows.set(tenantId, filtered);
    throw new QuotaExceededError("Transition rate limit exceeded. Retry in 60 seconds.");
  }
  filtered.push(now);
  windows.set(tenantId, filtered);
}
