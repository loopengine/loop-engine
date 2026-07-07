import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalize,
  CanonicalizationError,
  sha256CanonicalHex,
} from "@loop-engine/canonical-json";
import { canonicalizeSnapshotValues } from "../canonicalize-snapshot-values.js";

describe("canonicalizeSnapshotValues", () => {
  it("delegates to @loop-engine/canonical-json for semantic values", () => {
    const values = {
      invoiceNumber: "INV-2026-004521",
      amount: 12500,
      currency: "USD",
      lineItems: [{ sku: "WIDGET-1", qty: 2 }],
    };

    expect(canonicalizeSnapshotValues(values)).toBe(canonicalize(values));
  });

  it("sorts keys deterministically for stable hashes across object construction order", () => {
    const values = { z: 1, a: { y: 2, b: 3 } };
    expect(canonicalizeSnapshotValues(values)).toBe('{"a":{"b":3,"y":2},"z":1}');
  });

  it("produces bytes that sha256CanonicalHex hashes from the same values", () => {
    const values = { tenantId: "org_demo_alpine", decision: "approve" };
    const canonical = canonicalizeSnapshotValues(values);
    const fromCanonical = createHash("sha256").update(canonical, "utf8").digest("hex");
    expect(fromCanonical).toBe(sha256CanonicalHex(values));
  });

  it("rejects non-canonicalizable semantic values", () => {
    expect(() => canonicalizeSnapshotValues({ amount: NaN })).toThrow(
      CanonicalizationError
    );
  });
});
