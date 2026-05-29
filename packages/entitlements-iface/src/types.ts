// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/**
 * Frozen entitlements snapshot for a single tenant. Mirrors the shape used by
 * `apps/hosted-loops` so the same handler code can be backed by either the
 * proprietary database snapshot or the OSS memory adapter without branching.
 *
 *  - `tier` — coarse capability tier (0 = none, 1 = baseline, 2/3 = paid).
 *    Self-host defaults to `1`.
 *  - `snapshotJson` — opaque feature blob; advanced gates can introspect it.
 *  - `packKey` / `packVersion` — version metadata for the snapshot generator.
 */
export type EntitlementsSnapshot = {
  organizationId: string;
  packKey: string;
  packVersion: number;
  snapshotJson: unknown;
  computedAt: Date;
  lastUpdated: Date;
  tier: number;
};

/**
 * `EntitlementsAdapter` is the integration seam the runtime calls to resolve
 * a tenant's entitlements before mounting any RT-01 frozen-surface handler.
 *
 * Implementations:
 *  - `MemoryEntitlementsAdapter` — fixed tier-1 default for self-host (this package).
 *  - Hosted adapter — proprietary, queries the entitlements DB in `apps/hosted-loops`.
 */
export interface EntitlementsAdapter {
  getEntitlements(tenantId: string): Promise<EntitlementsSnapshot>;
}

/** Thrown by quota helpers when the tenant fails an entitlement check (mapped to HTTP 403). */
export class EntitlementsDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntitlementsDeniedError";
  }
}

/** Thrown by quota helpers when the tenant exceeds a rate limit (mapped to HTTP 429). */
export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}
