// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import type { EvidenceSnapshotPersisted } from "./types.js";

/**
 * Insert-only persistence port for frozen evidence snapshots.
 *
 * Implemented by consumers (e.g. Boss Loops Prisma adapter). The OSS engine
 * depends on this interface only — never on Prisma or database packages.
 */
export interface SnapshotStore {
  insertSnapshots(input: {
    tenantId: string;
    aggregateId: string;
    snapshots: EvidenceSnapshotPersisted[];
  }): Promise<{ snapshotIds: string[] }>;
}
