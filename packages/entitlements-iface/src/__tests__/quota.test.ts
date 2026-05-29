import { describe, expect, it } from "vitest";

import {
  assertRuntimeAllowed,
  EntitlementsDeniedError,
  QuotaExceededError,
  recordTransitionWithinLimit,
  transitionsPerMinuteForTier,
  type EntitlementsSnapshot,
} from "../index.js";

const NOW = 1_700_000_000_000;

function snapshot(tier: number): EntitlementsSnapshot {
  return {
    organizationId: "default",
    packKey: "self-host",
    packVersion: 1,
    snapshotJson: {},
    computedAt: new Date(NOW),
    lastUpdated: new Date(NOW),
    tier,
  };
}

describe("assertRuntimeAllowed", () => {
  it("passes for tier >= 1", () => {
    expect(() => assertRuntimeAllowed(snapshot(1))).not.toThrow();
    expect(() => assertRuntimeAllowed(snapshot(3))).not.toThrow();
  });

  it("throws EntitlementsDeniedError for tier 0", () => {
    expect(() => assertRuntimeAllowed(snapshot(0))).toThrowError(EntitlementsDeniedError);
  });
});

describe("transitionsPerMinuteForTier", () => {
  it("maps tiers to the documented ladder", () => {
    expect(transitionsPerMinuteForTier(0)).toBe(60);
    expect(transitionsPerMinuteForTier(1)).toBe(60);
    expect(transitionsPerMinuteForTier(2)).toBe(300);
    expect(transitionsPerMinuteForTier(3)).toBe(1000);
    expect(transitionsPerMinuteForTier(7)).toBe(1000);
  });
});

describe("recordTransitionWithinLimit", () => {
  it("permits transitions up to the tier limit", () => {
    const windows = new Map<string, number[]>();
    const snap = snapshot(1);
    for (let i = 0; i < 60; i++) {
      recordTransitionWithinLimit("default", snap, windows, NOW + i);
    }
    expect(windows.get("default")?.length).toBe(60);
  });

  it("throws QuotaExceededError on the (limit + 1)th transition", () => {
    const windows = new Map<string, number[]>();
    const snap = snapshot(1);
    for (let i = 0; i < 60; i++) {
      recordTransitionWithinLimit("default", snap, windows, NOW + i);
    }
    expect(() => recordTransitionWithinLimit("default", snap, windows, NOW + 60)).toThrowError(
      QuotaExceededError,
    );
  });

  it("evicts entries older than the 60-second window", () => {
    const windows = new Map<string, number[]>();
    const snap = snapshot(1);
    for (let i = 0; i < 60; i++) {
      recordTransitionWithinLimit("default", snap, windows, NOW + i);
    }
    expect(() =>
      recordTransitionWithinLimit("default", snap, windows, NOW + 120_000),
    ).not.toThrow();
    expect(windows.get("default")?.length).toBe(1);
  });
});
