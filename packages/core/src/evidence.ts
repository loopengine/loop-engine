// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * Shared evidence-payload types used by both the generic `guardEvidence`
 * primitive in this package (`packages/core/src/toolAdapter.ts`) and the
 * opinionated PII-redaction helper `redactPiiEvidence` in
 * `@loop-engine/sdk`.
 *
 * Relocated from `@loop-engine/sdk` to `@loop-engine/core` per
 * MECHANICAL 8.16 extension (PB-EX-03 Option A, 2026-04-23): both
 * guarding functions reference this type, so core is the correct
 * home for the shared contract — same closure-of-type-graph
 * principle as the PB-EX-01 / PB-EX-04 relocations of `ActorAdapter`
 * context and actor types.
 */

export type EvidenceValue = string | number | boolean | null;
export type EvidenceRecord = Record<string, EvidenceValue>;
