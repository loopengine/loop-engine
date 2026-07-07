// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { canonicalize } from "@loop-engine/canonical-json";

/**
 * Semantic Decision Record payload submitted on a governed transition.
 *
 * Hashed via canonical JSON in Phase 3 — never database rows or ORM encoding.
 */
export type SnapshotSemanticValues = Record<string, unknown>;

/**
 * Produce the canonical JSON string for a snapshot's semantic `values`.
 *
 * Delegates to `@loop-engine/canonical-json`. Throws `CanonicalizationError`
 * when `values` cannot be deterministically serialized (NaN, undefined, etc.).
 */
export function canonicalizeSnapshotValues(values: SnapshotSemanticValues): string {
  return canonicalize(values);
}
