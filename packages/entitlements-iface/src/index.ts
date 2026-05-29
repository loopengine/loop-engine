// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/**
 * `@loop-engine/entitlements-iface` — entitlements seam for the OSS Loop Engine runtime.
 *
 * Exports:
 *   - `EntitlementsSnapshot` / `EntitlementsAdapter` types
 *   - `MemoryEntitlementsAdapter` (fixed tier-1 default for self-host)
 *   - `EntitlementsDeniedError` / `QuotaExceededError` sentinel errors
 *   - `assertRuntimeAllowed`, `transitionsPerMinuteForTier`, `recordTransitionWithinLimit` helpers
 *
 * The proprietary hosted adapter — backed by the `EntitlementsSnapshot` table
 * and per-pack tier inference — stays in `apps/hosted-loops` and never imports
 * from `@repo/database` in OSS.
 */
export type { EntitlementsAdapter, EntitlementsSnapshot } from "./types.js";
export { EntitlementsDeniedError, QuotaExceededError } from "./types.js";
export {
  MemoryEntitlementsAdapter,
  type MemoryEntitlementsAdapterOptions,
} from "./memory-adapter.js";
export {
  assertRuntimeAllowed,
  recordTransitionWithinLimit,
  transitionsPerMinuteForTier,
} from "./quota.js";
