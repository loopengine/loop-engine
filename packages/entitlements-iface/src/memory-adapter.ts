// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import type { EntitlementsAdapter, EntitlementsSnapshot } from "./types.js";

export type MemoryEntitlementsAdapterOptions = {
  /** Tier returned for every tenant. Defaults to `1` (baseline self-host). */
  tier?: number;
  /** Pack identity reported on the snapshot. Defaults to `"self-host"`. */
  packKey?: string;
  packVersion?: number;
  /** Per-tenant override that wins over the defaults if set. */
  overrides?: Record<string, Partial<EntitlementsSnapshot>>;
};

/**
 * In-memory `EntitlementsAdapter` that returns a fixed snapshot for any tenant.
 *
 * RT-16 self-host mode bypassed the proprietary entitlements lookup inside
 * `apps/hosted-loops` via an env-var flag. RT-20a moves that fallback out of
 * the hosted app and into a first-class OSS package so the OSS runtime never
 * needs to import `@repo/database` to know "everything is allowed at tier 1".
 */
export class MemoryEntitlementsAdapter implements EntitlementsAdapter {
  private readonly tier: number;
  private readonly packKey: string;
  private readonly packVersion: number;
  private readonly overrides: Record<string, Partial<EntitlementsSnapshot>>;

  constructor(opts: MemoryEntitlementsAdapterOptions = {}) {
    this.tier = opts.tier ?? 1;
    this.packKey = opts.packKey ?? "self-host";
    this.packVersion = opts.packVersion ?? 1;
    this.overrides = opts.overrides ?? {};
  }

  async getEntitlements(tenantId: string): Promise<EntitlementsSnapshot> {
    const now = new Date();
    const base: EntitlementsSnapshot = {
      organizationId: tenantId,
      packKey: this.packKey,
      packVersion: this.packVersion,
      snapshotJson: { features: { hosted_loops: true } },
      computedAt: now,
      lastUpdated: now,
      tier: this.tier,
    };
    const override = this.overrides[tenantId];
    return override ? { ...base, ...override } : base;
  }
}
