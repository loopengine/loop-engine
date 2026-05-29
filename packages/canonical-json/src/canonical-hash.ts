// Copyright (c) Better Data, Inc. and contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Canonicalization + SHA-256 helpers for tamper-evident artifacts (baseline
 * manifests, loop-definition hashes, source-data digests).
 *
 * The canonical form follows the spirit of RFC 8785 JSON Canonicalization
 * Scheme (JCS) for the subset of JSON we actually serialize:
 *
 *   - Object keys are sorted lexicographically (UTF-16 code unit order).
 *   - No whitespace.
 *   - Numbers serialize via the host JSON.stringify (caveat below — we do
 *     NOT accept arbitrary numbers; see `assertCanonicalizable`).
 *   - Strings serialize via the host JSON.stringify (escaping is
 *     deterministic across V8 / SpiderMonkey for the BMP, which is the
 *     subset we permit).
 *   - Booleans, null serialize as "true" / "false" / "null".
 *   - Arrays preserve order.
 *
 * What we deliberately do NOT support, to keep the implementation small and
 * predictable:
 *
 *   - Non-finite numbers (NaN, ±Infinity) — JSON cannot represent them; we
 *     throw to surface authoring bugs rather than silently produce a
 *     non-canonical string.
 *   - JS numbers larger than `Number.MAX_SAFE_INTEGER` — we throw because
 *     such values lose precision and produce different hashes on the round
 *     trip. Decimal-precision data must arrive as strings.
 *   - Non-BMP strings with lone surrogates — we throw, because cross-runtime
 *     escaping divergence is exactly the kind of bug a hash check is
 *     supposed to catch, not paper over.
 *   - `undefined`, functions, symbols — they have no JSON representation.
 *
 * If a future caller needs full RFC 8785 conformance (e.g., to interop with
 * a third-party verifier in a non-JS runtime), swap in a real JCS library
 * (`@cyclonedx/canonical-json` or similar). The interface (`canonicalize`
 * + `sha256CanonicalHex`) is stable; the body is the only thing that
 * changes.
 *
 * History: this implementation was extracted from
 * `packages/oss/loop-engine-baselines/src/canonical-hash.ts` to consolidate
 * three near-duplicate inline canonicalizers that had drifted across the
 * monorepo (`dcm-governed-ai/registry/register*.ts`,
 * `apps/registry-loop/services/canonicalization.ts`,
 * `apps/registry-loop/prisma/seed.ts`). The regression-equivalence harness
 * at `src/__tests__/regression-equivalence.test.ts` documents what
 * convergence with the prior implementations was verified against.
 */

import { createHash } from "node:crypto";

export type CanonicalizableValue =
  | string
  | number
  | boolean
  | null
  | CanonicalizableValue[]
  | { [key: string]: CanonicalizableValue };

export class CanonicalizationError extends Error {
  constructor(message: string, public readonly path: string) {
    super(`${message} (at ${path})`);
    this.name = "CanonicalizationError";
  }
}

function assertCanonicalizable(value: unknown, path: string): asserts value is CanonicalizableValue {
  if (value === null) {
    return;
  }
  switch (typeof value) {
    case "boolean":
      return;
    case "string":
      for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code >= 0xd800 && code <= 0xdfff) {
          const isHigh = code <= 0xdbff;
          const next = value.charCodeAt(i + 1);
          const pairOk = isHigh && next >= 0xdc00 && next <= 0xdfff;
          if (!pairOk) {
            throw new CanonicalizationError(
              "lone surrogate in string is not canonicalizable",
              path
            );
          }
          i++;
        }
      }
      return;
    case "number":
      if (!Number.isFinite(value)) {
        throw new CanonicalizationError(
          `non-finite number (${value}) is not canonicalizable; pass a string instead`,
          path
        );
      }
      if (Number.isInteger(value) && Math.abs(value) > Number.MAX_SAFE_INTEGER) {
        throw new CanonicalizationError(
          "integer exceeds Number.MAX_SAFE_INTEGER; pass a string to preserve precision",
          path
        );
      }
      return;
    case "object": {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          assertCanonicalizable(value[i], `${path}[${i}]`);
        }
        return;
      }
      const obj = value as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        assertCanonicalizable(obj[key], path === "$" ? `$.${key}` : `${path}.${key}`);
      }
      return;
    }
    default:
      throw new CanonicalizationError(
        `value of type ${typeof value} is not canonicalizable`,
        path
      );
  }
}

function canonicalSerialize(value: CanonicalizableValue): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const parts = value.map((v) => canonicalSerialize(v));
    return `[${parts.join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const parts: string[] = [];
  for (const key of keys) {
    parts.push(`${JSON.stringify(key)}:${canonicalSerialize(value[key]!)}`);
  }
  return `{${parts.join(",")}}`;
}

/**
 * Produce the canonical JSON serialization of a value.
 *
 * Throws `CanonicalizationError` on inputs that cannot be deterministically
 * serialized (NaN, lone surrogates, oversize integers, undefined, etc.).
 * The error includes a JSONPath-style location so authoring bugs are easy
 * to locate.
 */
export function canonicalize(value: unknown): string {
  assertCanonicalizable(value, "$");
  return canonicalSerialize(value);
}

/** Lowercase hex SHA-256 of the canonical serialization of `value`. */
export function sha256CanonicalHex(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

/**
 * Convenience helper: compute the SHA-256 of arbitrary string input
 * (used by callers that have already pre-canonicalized, e.g., a CSV export).
 */
export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256")
    .update(typeof input === "string" ? input : input)
    .digest("hex");
}
