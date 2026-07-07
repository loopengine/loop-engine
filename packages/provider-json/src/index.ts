// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertEvidenceSnapshotProposed,
  snapshotContentHash,
  type EvidenceSnapshotProposed,
} from "@loop-engine/evidence";
import type {
  EvidenceProvider,
  EvidenceProviderResolveInput,
  EvidenceProviderSnapshotInput,
  ProviderArchetype,
  ProviderCapabilityProfile,
  ProviderRole,
} from "@loop-engine/provider-api";

export const JSON_PROVIDER_CONFORMANCE_VERSION = "provider-conformance-0.1.0";

export type JsonProviderSnapshotEntry = {
  sourceRef: string;
  resolve?: Record<string, unknown> | null;
  snapshot: EvidenceSnapshotProposed;
};

export type JsonEvidenceProviderConfig = {
  providerId: string;
  displayName: string;
  role?: ProviderRole;
  archetype?: ProviderArchetype;
  conformanceSuiteVersion?: string;
  /** Inline catalog keyed by sourceRef. */
  entries?: JsonProviderSnapshotEntry[];
  /** Load catalog from a JSON file (array of entries). */
  catalogPath?: string;
};

function loadCatalog(config: JsonEvidenceProviderConfig): Map<string, JsonProviderSnapshotEntry> {
  let rows = config.entries ?? [];
  if (config.catalogPath) {
    const raw = readFileSync(path.resolve(config.catalogPath), "utf8");
    rows = JSON.parse(raw) as JsonProviderSnapshotEntry[];
  }

  const map = new Map<string, JsonProviderSnapshotEntry>();
  for (const row of rows) {
    map.set(row.sourceRef, row);
  }
  return map;
}

function capabilityFromConfig(
  config: JsonEvidenceProviderConfig,
): ProviderCapabilityProfile {
  return {
    providerId: config.providerId,
    displayName: config.displayName,
    role: config.role ?? "source",
    archetype: config.archetype ?? "manual",
    provenanceCeiling: "origin-attested",
    definitionCeiling: "governed",
    freshnessSupported: true,
    suppliesLineage: true,
    suppliesVersion: true,
    suppliesMeasurements: true,
    conformanceSuiteVersion:
      config.conformanceSuiteVersion ?? JSON_PROVIDER_CONFORMANCE_VERSION,
  };
}

/**
 * Reference file/JSON provider — maps sourceRef → proposed snapshot.
 * Qualification is inherited from fixture mapping, never caller-asserted.
 */
export function createJsonEvidenceProvider(
  config: JsonEvidenceProviderConfig,
): EvidenceProvider {
  const catalog = loadCatalog(config);
  const capability = capabilityFromConfig(config);

  return {
    capability,
    async resolve(input: EvidenceProviderResolveInput) {
      const entry = catalog.get(input.sourceRef);
      return entry?.resolve ?? null;
    },
    async snapshot(input: EvidenceProviderSnapshotInput) {
      const entry = catalog.get(input.sourceRef);
      if (!entry) {
        throw new Error(`json provider: unknown sourceRef ${input.sourceRef}`);
      }

      const proposed = assertEvidenceSnapshotProposed({
        ...entry.snapshot,
        snapshotKey: input.snapshotKey ?? entry.snapshot.snapshotKey,
        capturedAt: input.capturedAt ?? entry.snapshot.capturedAt,
        capturedBy: input.capturedBy,
        providerId: capability.providerId,
        conformanceSuiteVersion: capability.conformanceSuiteVersion,
        contentSha256: snapshotContentHash(entry.snapshot.values),
      });

      return proposed;
    },
  };
}
