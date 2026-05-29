// Copyright (c) Better Data, Inc. and contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Basic unit tests for `canonicalize` + `sha256CanonicalHex`. Mirrors the
 * tests that previously lived at
 * `packages/oss/loop-engine-baselines/src/__tests__/canonical-hash.test.ts`
 * (which becomes a re-export consumer of this package once Track 4 PR-A's
 * migration step lands).
 *
 * For cross-implementation equivalence with the four legacy inline
 * canonicalizers see `regression-equivalence.test.ts`.
 */

import { describe, expect, it } from "vitest";
import {
  canonicalize,
  CanonicalizationError,
  sha256CanonicalHex,
} from "../canonical-hash.js";

describe("canonicalize", () => {
  it("sorts object keys lexicographically", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("preserves array order", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });

  it("recursively sorts nested objects", () => {
    const out = canonicalize({ z: { b: 1, a: 2 }, a: 1 });
    expect(out).toBe('{"a":1,"z":{"a":2,"b":1}}');
  });

  it("emits no whitespace", () => {
    const out = canonicalize({ a: [1, 2, { x: "y" }] });
    expect(out).not.toMatch(/\s/);
  });

  it("rejects NaN and Infinity", () => {
    expect(() => canonicalize({ x: NaN })).toThrow(CanonicalizationError);
    expect(() => canonicalize({ x: Infinity })).toThrow(CanonicalizationError);
    expect(() => canonicalize({ x: -Infinity })).toThrow(CanonicalizationError);
  });

  it("rejects integers exceeding MAX_SAFE_INTEGER", () => {
    expect(() => canonicalize({ x: Number.MAX_SAFE_INTEGER + 2 })).toThrow(
      CanonicalizationError
    );
  });

  it("rejects undefined", () => {
    expect(() => canonicalize({ x: undefined } as unknown)).toThrow(
      CanonicalizationError
    );
  });

  it("rejects functions", () => {
    expect(() => canonicalize({ x: () => 1 } as unknown)).toThrow(
      CanonicalizationError
    );
  });

  it("includes a JSONPath in the error message", () => {
    try {
      canonicalize({ outer: { inner: NaN } });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CanonicalizationError);
      expect((err as CanonicalizationError).path).toBe("$.outer.inner");
    }
  });
});

describe("sha256CanonicalHex", () => {
  it("produces a stable hash across runs", () => {
    const value = {
      tenantId: "t-1",
      loopId: "scm.demand-forecast",
      metric: "forecast_wape",
      metricVersion: "v1",
      windowStart: "2026-01-01T00:00:00Z",
      windowEnd: "2026-04-01T00:00:00Z",
      skuScope: { type: "explicit", skus: ["A", "B", "C"] },
      baselineValue: "0.873421",
      attributionRule: "system_of_record_only",
      capPercentOfPlatformFee: "0.30",
      sourceDataHash: "deadbeef",
    };
    const a = sha256CanonicalHex(value);
    const b = sha256CanonicalHex(value);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is invariant to object key order", () => {
    const a = sha256CanonicalHex({ a: 1, b: 2, c: { x: 1, y: 2 } });
    const b = sha256CanonicalHex({ c: { y: 2, x: 1 }, b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it("differs when any field changes", () => {
    const base = { a: 1, b: "x" };
    const a = sha256CanonicalHex(base);
    const b = sha256CanonicalHex({ ...base, b: "y" });
    expect(a).not.toBe(b);
  });
});
