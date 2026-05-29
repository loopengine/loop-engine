import { describe, expect, it } from "vitest";

import { MemoryEntitlementsAdapter } from "../index.js";

describe("MemoryEntitlementsAdapter", () => {
  it("returns a tier-1 self-host snapshot by default", async () => {
    const adapter = new MemoryEntitlementsAdapter();
    const snap = await adapter.getEntitlements("default");
    expect(snap.tier).toBe(1);
    expect(snap.packKey).toBe("self-host");
    expect(snap.packVersion).toBe(1);
    expect(snap.organizationId).toBe("default");
    expect(snap.snapshotJson).toEqual({ features: { hosted_loops: true } });
  });

  it("honors a custom tier / packKey", async () => {
    const adapter = new MemoryEntitlementsAdapter({
      tier: 3,
      packKey: "enterprise",
      packVersion: 7,
    });
    const snap = await adapter.getEntitlements("tenant_a");
    expect(snap.tier).toBe(3);
    expect(snap.packKey).toBe("enterprise");
    expect(snap.packVersion).toBe(7);
  });

  it("applies per-tenant overrides on top of the defaults", async () => {
    const adapter = new MemoryEntitlementsAdapter({
      overrides: { high_value: { tier: 3 } },
    });
    const base = await adapter.getEntitlements("default");
    const elevated = await adapter.getEntitlements("high_value");
    expect(base.tier).toBe(1);
    expect(elevated.tier).toBe(3);
    expect(elevated.packKey).toBe("self-host");
  });
});
