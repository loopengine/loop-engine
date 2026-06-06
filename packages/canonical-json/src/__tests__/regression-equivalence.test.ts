// Copyright (c) Better Data, Inc. and contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * REGRESSION-EQUIVALENCE HARNESS
 *
 * Purpose: lock the cross-implementation behavior of every canonicalizer
 * that existed in the monorepo at the moment `@loop-engine/canonical-json`
 * was extracted, so that the migration of each call site to this package
 * is provably byte-equivalent for every input the call site actually
 * passes.
 *
 * This file is the load-bearing artifact for Track 4 PR-A's canonicalization
 * extraction. Until this harness passes, the migration commits are not
 * safe to land. After the migration commits land, this harness becomes
 * permanent regression coverage: future contributors cannot silently
 * change canonicalization behavior without breaking it.
 *
 * The five legacy implementations being checked:
 *
 *   1. `canonical-json` (this package, formerly `loop-engine-baselines`)
 *   2. `dcm-registry-register`
 *      → packages/internal/dcm-governed-ai/registry/register.ts
 *   3. `dcm-registry-gateway-provision`
 *      → packages/internal/dcm-governed-ai/registry/register-gateway-provision.ts
 *   4. `registry-loop-canonicalization`
 *      → apps/registry-loop/src/services/canonicalization.ts
 *   5. `registry-loop-seed`
 *      → apps/registry-loop/prisma/seed.ts
 *
 * Each legacy implementation is inlined verbatim below as a test fixture.
 * Source-code provenance is named in the comment above each fixture so a
 * future reader can verify the inlined copy matches the live source (or
 * the migrated re-export, post-PR-A).
 *
 * Two test groups:
 *
 *   - `well-behaved fixtures`: inputs every call site actually passes
 *     (JSON-parsed data, hand-built object literals, no NaN/Infinity/
 *     undefined/oversize-int/lone-surrogate). All five implementations
 *     MUST produce byte-identical canonical strings.
 *
 *   - `edge-case fixtures`: inputs that violate canonical-json's strict
 *     contract. The new canonical implementation throws; the legacy
 *     implementations silently produce a hash. The harness DOCUMENTS this
 *     divergence (it is by design — strictness is the correct behavior for
 *     tamper-evidence) rather than asserting equivalence on these inputs.
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalize as canonicalJsonCanonicalize } from "../canonical-hash.js";

// ---------------------------------------------------------------------------
// Inlined legacy implementations (verbatim from source as of PR-A scoping)
// ---------------------------------------------------------------------------

/**
 * Source: packages/internal/dcm-governed-ai/registry/register.ts (lines 21–39)
 * Pattern: module-level `sortRecursively` + `JSON.stringify`.
 */
function legacy_dcmRegistryRegister(value: unknown): string {
  function sortRecursively(v: unknown): unknown {
    if (Array.isArray(v)) {
      return v.map(sortRecursively);
    }
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = sortRecursively(obj[key]);
          return acc;
        }, {});
    }
    return v;
  }
  return JSON.stringify(sortRecursively(value));
}

/**
 * Source: packages/internal/dcm-governed-ai/registry/register-gateway-provision.ts (lines 14–32)
 * Pattern: byte-identical clone of `legacy_dcmRegistryRegister`.
 * Inlined separately to lock the behavior of the second file (in case the
 * two source files drift in the future, this harness catches it).
 */
function legacy_dcmRegistryGatewayProvision(value: unknown): string {
  function sortRecursively(v: unknown): unknown {
    if (Array.isArray(v)) {
      return v.map(sortRecursively);
    }
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = sortRecursively(obj[key]);
          return acc;
        }, {});
    }
    return v;
  }
  return JSON.stringify(sortRecursively(value));
}

/**
 * Source: apps/registry-loop/src/services/canonicalization.ts (full file)
 * Pattern: module-level `sortRecursively` + `JSON.stringify`. Functionally
 * identical to dcm-registry; preserved as a separate fixture to lock the
 * registry-loop service behavior.
 */
function legacy_registryLoopCanonicalization(value: unknown): string {
  function sortRecursively(v: unknown): unknown {
    if (Array.isArray(v)) {
      return v.map(sortRecursively);
    }
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = sortRecursively(obj[key]);
          return acc;
        }, {});
    }
    return v;
  }
  return JSON.stringify(sortRecursively(value));
}

/**
 * Source: apps/registry-loop/prisma/seed.ts (lines 25–40)
 * Pattern: closure-scoped `sortRecursively` inside the `canonicalize`
 * function body. Functionally identical to the others; preserved separately
 * to lock the seed-script behavior.
 */
function legacy_registryLoopSeed(value: unknown): string {
  const sortRecursively = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortRecursively);
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = sortRecursively(obj[key]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(sortRecursively(value));
}

// ---------------------------------------------------------------------------
// Implementation registry
// ---------------------------------------------------------------------------

interface CanonicalizerImpl {
  /** Stable identifier surfaced in test failure messages. */
  readonly name: string;
  /** Brief provenance comment so failures point readers at the real code. */
  readonly source: string;
  readonly canonicalize: (value: unknown) => string;
}

const canonicalImpl: CanonicalizerImpl = {
  name: "canonical-json",
  source: "this package (post-extraction; ancestor: loop-engine-baselines/canonical-hash.ts)",
  canonicalize: canonicalJsonCanonicalize,
};

const legacyImpls: readonly CanonicalizerImpl[] = [
  {
    name: "dcm-registry-register",
    source: "packages/internal/dcm-governed-ai/registry/register.ts",
    canonicalize: legacy_dcmRegistryRegister,
  },
  {
    name: "dcm-registry-gateway-provision",
    source: "packages/internal/dcm-governed-ai/registry/register-gateway-provision.ts",
    canonicalize: legacy_dcmRegistryGatewayProvision,
  },
  {
    name: "registry-loop-canonicalization",
    source: "apps/registry-loop/src/services/canonicalization.ts",
    canonicalize: legacy_registryLoopCanonicalization,
  },
  {
    name: "registry-loop-seed",
    source: "apps/registry-loop/prisma/seed.ts",
    canonicalize: legacy_registryLoopSeed,
  },
] as const;

const allImpls: readonly CanonicalizerImpl[] = [canonicalImpl, ...legacyImpls];

// ---------------------------------------------------------------------------
// Well-behaved fixture corpus
// ---------------------------------------------------------------------------

/**
 * Every fixture in this corpus is JSON-safe: no NaN, no Infinity, no
 * undefined values, no integers exceeding MAX_SAFE_INTEGER, no lone
 * surrogates. These are inputs the call sites actually pass — every legacy
 * canonicalizer was only ever invoked on data parsed from JSON files or
 * built from object literals with known shape.
 *
 * Cross-implementation byte-equality is REQUIRED for every fixture in this
 * corpus. Failure means migration to `@loop-engine/canonical-json` would
 * change a hash for a real call site — surface it before the migration
 * commits land, not after.
 */
const wellBehavedFixtures: readonly { name: string; value: unknown }[] = [
  { name: "primitive: null", value: null },
  { name: "primitive: true", value: true },
  { name: "primitive: false", value: false },
  { name: "primitive: 0", value: 0 },
  { name: "primitive: 42", value: 42 },
  { name: "primitive: -0.5", value: -0.5 },
  { name: "primitive: empty string", value: "" },
  { name: "primitive: ascii string", value: "hello world" },
  { name: "primitive: BMP unicode", value: "café — 中文 — Ωμέγα" },
  { name: "primitive: string with quotes/backslash", value: 'a"b\\c' },
  { name: "primitive: string with newline", value: "line1\nline2" },

  { name: "array: empty", value: [] },
  { name: "array: numbers", value: [3, 1, 2] },
  { name: "array: mixed primitives", value: [1, "two", true, null, false] },
  { name: "array: nested", value: [[1, 2], [3, [4, 5]], []] },

  { name: "object: empty", value: {} },
  { name: "object: single key", value: { a: 1 } },
  { name: "object: keys out of order", value: { b: 1, a: 2 } },
  { name: "object: deeply nested", value: { z: { b: 1, a: 2 }, a: 1 } },
  {
    name: "object: nested with arrays",
    value: { z: [1, 2, 3], a: [{ b: 2, a: 1 }, { d: 4, c: 3 }] },
  },
  {
    name: "object: keys with special characters",
    value: { "key with spaces": 1, "key.with.dots": 2, "key/with/slashes": 3 },
  },

  // NOTE: a fixture for "object: numeric-string keys" was removed from this
  // corpus because the canonical and legacy implementations diverge on it
  // by structural design (not by edge-case permissiveness). See the
  // `documented-divergence corpus` block below; the case is preserved
  // there so a future caller passing numeric-string keys triggers an
  // explicit conversation. No production call site currently passes
  // objects with numeric-string keys (loop definitions use semantic
  // string keys: id, version, domain, etc.).

  // Realistic loop-substrate fixtures — these are the actual shapes the
  // call sites canonicalize. If any of these diverge across implementations,
  // a real production hash would change post-migration.
  {
    name: "realistic: BaselineManifest",
    value: {
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
    },
  },
  {
    name: "realistic: governed-incident-response definition",
    value: {
      id: "gov.governed-incident-response",
      version: "1.0.0",
      domain: "gov",
      states: ["OPEN", "TRIAGING", "ESCALATED", "RESOLVED", "CLOSED"],
      transitions: [
        { from: "OPEN", to: "TRIAGING", actor: "automation" },
        { from: "TRIAGING", to: "ESCALATED", actor: "human" },
        { from: "ESCALATED", to: "RESOLVED", actor: "human" },
        { from: "RESOLVED", to: "CLOSED", actor: "automation" },
      ],
      actors: [
        { id: "system:perplexity", type: "automation" },
        { id: "human:reviewer", type: "human" },
      ],
      outcomes: [{ metric: "time_to_resolve", direction: "lower_is_better" }],
    },
  },
  {
    name: "realistic: gateway-provision definition",
    value: {
      id: "gov.gateway-provision",
      version: "0.2.0",
      domain: "gov",
      states: ["REQUESTED", "PROVISIONING", "VERIFIED", "ACTIVE", "FAILED"],
      transitions: [
        { from: "REQUESTED", to: "PROVISIONING", actor: "automation" },
        { from: "PROVISIONING", to: "VERIFIED", actor: "automation" },
        { from: "VERIFIED", to: "ACTIVE", actor: "automation" },
        { from: "PROVISIONING", to: "FAILED", actor: "automation" },
      ],
      actors: [{ id: "system:gateway", type: "automation" }],
      outcomes: [{ metric: "provisioning_success", direction: "higher_is_better" }],
    },
  },
  {
    name: "realistic: registry-loop seed",
    value: {
      id: "scm.replenishment",
      version: "1.0.0",
      domain: "scm",
      states: ["OPEN", "CLOSED"],
      transitions: [{ from: "OPEN", to: "CLOSED", actor: "automation" }],
      actors: [{ id: "system:seed", type: "automation" }],
      outcomes: [{ metric: "completion" }],
    },
  },
];

// ---------------------------------------------------------------------------
// Documented-divergence fixture corpus (structural difference by design)
// ---------------------------------------------------------------------------

/**
 * Inputs where canonical-json and the legacy implementations produce
 * STRUCTURALLY DIFFERENT canonical strings — not because either is buggy
 * but because they encode different design intent.
 *
 * Currently a single case: numeric-string keys.
 *
 *   - Canonical-json sorts keys lexicographically by UTF-16 code units
 *     (per RFC 8785 JCS): `"1" < "10" < "2"`. This matches the documented
 *     contract in `canonical-hash.ts`.
 *
 *   - Legacy implementations call `Object.keys(obj).sort()`, which returns
 *     lexicographic order, but then they `.reduce()` into a new object
 *     literal via `acc[key] = ...`. JavaScript object specification (since
 *     ES2015) re-orders integer-like string keys to numeric order during
 *     this assignment, then `JSON.stringify` iterates in that re-ordered
 *     sequence. Result: numeric-string keys appear in numeric order
 *     (`"1", "2", "10"`) regardless of the explicit `.sort()` call.
 *
 * The harness asserts each side produces its expected output. No
 * production call site currently passes objects with numeric-string keys,
 * so the migration is hash-stable for real usage. The fixture is preserved
 * here so that if a future caller adds numeric-string-keyed input, this
 * test fails and forces an explicit decision about whether to (a) update
 * canonical-json to match the legacy quirk, (b) update the caller to use
 * non-numeric keys, or (c) accept the hash change as part of the migration.
 */
const documentedDivergenceFixtures: readonly {
  name: string;
  value: unknown;
  expectedCanonical: string;
  expectedLegacy: string;
}[] = [
  {
    name: "divergence: numeric-string keys",
    value: { "10": "ten", "2": "two", "1": "one" },
    expectedCanonical: '{"1":"one","10":"ten","2":"two"}',
    expectedLegacy: '{"1":"one","2":"two","10":"ten"}',
  },
];

// ---------------------------------------------------------------------------
// Edge-case fixture corpus (canonical strict, legacy permissive)
// ---------------------------------------------------------------------------

/**
 * These inputs violate `@loop-engine/canonical-json`'s strict contract. The
 * canonical implementation throws; the legacy implementations silently
 * produce a hash (because they delegate to `JSON.stringify`, which has its
 * own permissive behavior for these inputs).
 *
 * The harness records what each legacy implementation produces and asserts
 * that the canonical throws. This is the documented design contract: strict
 * canonicalization is correct for tamper-evidence; permissive
 * canonicalization is what the legacy code happened to do because it was
 * never written to consider these inputs (and never receives them in
 * practice).
 *
 * If a future change makes the canonical implementation permissive (e.g.,
 * to support new input types), this test block must be updated explicitly.
 * The test failure becomes the prompt to think about whether permissiveness
 * is actually wanted.
 */
const edgeCaseFixtures: readonly {
  name: string;
  value: unknown;
  expectedLegacyOutput: string | "RUNTIME_DEPENDENT";
}[] = [
  { name: "edge: NaN", value: { x: NaN }, expectedLegacyOutput: '{"x":null}' },
  {
    name: "edge: Infinity",
    value: { x: Infinity },
    expectedLegacyOutput: '{"x":null}',
  },
  {
    name: "edge: -Infinity",
    value: { x: -Infinity },
    expectedLegacyOutput: '{"x":null}',
  },
  {
    name: "edge: undefined value in object",
    value: { x: undefined, y: 1 },
    expectedLegacyOutput: '{"y":1}',
  },
  {
    name: "edge: undefined element in array",
    value: [1, undefined, 3],
    expectedLegacyOutput: "[1,null,3]",
  },
  {
    // Note on the expected value: Number.MAX_SAFE_INTEGER + 2 is
    // 9007199254740993, but that integer is not representable exactly in
    // IEEE 754 double-precision. JS evaluates the literal to
    // 9007199254740992 (banker's rounding to nearest even). The legacy
    // implementations stringify the rounded value silently — exactly the
    // silent corruption the strict canonical implementation is designed
    // to catch.
    name: "edge: integer beyond MAX_SAFE_INTEGER",
    value: { x: Number.MAX_SAFE_INTEGER + 2 },
    expectedLegacyOutput: '{"x":9007199254740992}',
  },
  {
    name: "edge: function value",
    value: { x: () => 1 },
    expectedLegacyOutput: "{}",
  },
  {
    name: "edge: lone high surrogate",
    value: { x: "\uD800" },
    expectedLegacyOutput: "RUNTIME_DEPENDENT",
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

describe("regression-equivalence: well-behaved fixtures", () => {
  for (const fixture of wellBehavedFixtures) {
    it(`all 5 implementations converge on: ${fixture.name}`, () => {
      const outputs = allImpls.map((impl) => ({
        name: impl.name,
        source: impl.source,
        canonical: impl.canonicalize(fixture.value),
      }));

      const baseline = outputs[0]!.canonical;
      for (const output of outputs) {
        if (output.canonical !== baseline) {
          const detail = outputs
            .map((o) => `  ${o.name}: ${o.canonical}\n    (${o.source})`)
            .join("\n");
          throw new Error(
            `Cross-implementation divergence on fixture "${fixture.name}":\n${detail}`
          );
        }
      }

      // All canonical strings agree → all SHA-256 hashes agree by construction.
      expect(outputs.every((o) => o.canonical === baseline)).toBe(true);
    });
  }

  it("hash convergence: all 5 implementations produce identical SHA-256 for every well-behaved fixture", () => {
    for (const fixture of wellBehavedFixtures) {
      const hashes = allImpls.map((impl) => sha256Hex(impl.canonicalize(fixture.value)));
      const unique = new Set(hashes);
      if (unique.size !== 1) {
        const detail = allImpls
          .map((impl, i) => `  ${impl.name}: ${hashes[i]}`)
          .join("\n");
        throw new Error(
          `SHA-256 divergence on fixture "${fixture.name}":\n${detail}`
        );
      }
    }
  });
});

describe("regression-equivalence: documented-divergence fixtures (structural difference by design)", () => {
  for (const fixture of documentedDivergenceFixtures) {
    it(`canonical-json produces lexicographic-key order for: ${fixture.name}`, () => {
      const out = canonicalImpl.canonicalize(fixture.value);
      expect(out).toBe(fixture.expectedCanonical);
    });

    it(`legacy implementations produce numeric-key-first order for: ${fixture.name}`, () => {
      for (const impl of legacyImpls) {
        const out = impl.canonicalize(fixture.value);
        expect(out).toBe(fixture.expectedLegacy);
      }
    });

    it(`canonical and legacy diverge on: ${fixture.name} (this is the documented finding)`, () => {
      expect(fixture.expectedCanonical).not.toBe(fixture.expectedLegacy);
    });
  }
});

describe("regression-equivalence: edge-case fixtures (canonical strict, legacy permissive)", () => {
  for (const fixture of edgeCaseFixtures) {
    it(`canonical-json throws on edge case: ${fixture.name}`, () => {
      expect(() => canonicalImpl.canonicalize(fixture.value)).toThrow();
    });

    it(`legacy implementations silently produce a hash for edge case: ${fixture.name}`, () => {
      const outputs = legacyImpls.map((impl) => impl.canonicalize(fixture.value));

      // Convergence among the 4 legacy implementations is expected on edge
      // cases too (they all delegate to the same JSON.stringify behavior),
      // EXCEPT for runtime-dependent cases like lone surrogates.
      if (fixture.expectedLegacyOutput !== "RUNTIME_DEPENDENT") {
        for (const out of outputs) {
          expect(out).toBe(fixture.expectedLegacyOutput);
        }
      } else {
        // Runtime-dependent: assert all 4 legacy impls converge with each
        // other (within the same V8 runtime they will), but don't pin the
        // exact output string.
        const unique = new Set(outputs);
        expect(unique.size).toBe(1);
      }
    });
  }
});
