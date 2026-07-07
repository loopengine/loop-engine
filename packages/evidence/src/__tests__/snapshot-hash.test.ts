import { describe, expect, it } from "vitest";
import {
  sha256CanonicalHex,
  CanonicalizationError,
} from "@loop-engine/canonical-json";
import { snapshotContentHash } from "../snapshot-content-hash.js";

describe("snapshotContentHash", () => {
  it("matches sha256CanonicalHex for semantic values", () => {
    const values = {
      invoiceNumber: "INV-2026-004521",
      amount: 12500,
      currency: "USD",
    };
    expect(snapshotContentHash(values)).toBe(sha256CanonicalHex(values));
  });

  it("hashes the same bytes as canonicalizeSnapshotValues", () => {
    const values = { tenantId: "org_demo_alpine", decision: "approve" };
    expect(snapshotContentHash(values)).toBe(sha256CanonicalHex(values));
  });

  it("is invariant to object key order", () => {
    const a = snapshotContentHash({ z: 1, a: { y: 2, b: 3 } });
    const b = snapshotContentHash({ a: { b: 3, y: 2 }, z: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs when semantic content changes", () => {
    const base = { amount: 100, currency: "USD" };
    expect(snapshotContentHash(base)).not.toBe(
      snapshotContentHash({ ...base, amount: 101 })
    );
  });

  it("rejects non-canonicalizable semantic values", () => {
    expect(() => snapshotContentHash({ amount: NaN })).toThrow(
      CanonicalizationError
    );
  });
});
