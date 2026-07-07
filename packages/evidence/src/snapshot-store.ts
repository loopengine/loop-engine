// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import type { EvidenceSnapshotPersisted } from "./types.js";

/** Input to {@link SnapshotStore.insertSnapshots} — insert-only, no updates. */
export type SnapshotStoreInsertInput = {
  tenantId: string;
  aggregateId: string;
  snapshots: EvidenceSnapshotPersisted[];
};

/**
 * Insert-only persistence port for frozen evidence snapshots (Phase 4).
 *
 * Dependency direction (D8):
 *   Loop Engine → SnapshotStore → consumer adapter → database
 *
 * Implementations must not mutate existing rows. The OSS engine depends on
 * this interface only — never on Prisma or proprietary database packages.
 */
export interface SnapshotStore {
  insertSnapshots(input: SnapshotStoreInsertInput): Promise<{ snapshotIds: string[] }>;
}
