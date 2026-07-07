// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { sha256CanonicalHex } from "@loop-engine/canonical-json";
import type { SnapshotSemanticValues } from "./canonicalize-snapshot-values.js";

/**
 * Lowercase hex SHA-256 of a snapshot's semantic `values`.
 *
 * Equivalent to hashing `canonicalizeSnapshotValues(values)` — delegates to
 * `@loop-engine/canonical-json`. This is the `contentSha256` stored at commit
 * (Phase 3); never computed from database rows or ORM serialization.
 */
export function snapshotContentHash(values: SnapshotSemanticValues): string {
  return sha256CanonicalHex(values);
}
