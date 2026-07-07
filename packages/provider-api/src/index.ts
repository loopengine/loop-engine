// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import type {
  DefinitionRung,
  EvidenceSnapshotProposed,
  ProvenanceRung,
} from "@loop-engine/evidence";

/** ADR-0005 provider roles — conformance profiles follow role, not just archetype. */
export type ProviderRole = "source" | "derived" | "actor";

export type ProviderArchetype =
  | "semantic"
  | "operational"
  | "document"
  | "derived"
  | "manual";

/** Advertised supply ceiling — capability is advertised; qualification is required. */
export type ProviderCapabilityProfile = {
  providerId: string;
  displayName: string;
  role: ProviderRole;
  archetype: ProviderArchetype;
  provenanceCeiling: ProvenanceRung;
  definitionCeiling: DefinitionRung;
  freshnessSupported: boolean;
  suppliesLineage: boolean;
  suppliesVersion: boolean;
  suppliesMeasurements: boolean;
  conformanceSuiteVersion: string;
};

export type EvidenceProviderResolveInput = {
  sourceRef: string;
  context?: Record<string, unknown>;
};

export type EvidenceProviderSnapshotInput = EvidenceProviderResolveInput & {
  capturedBy: string;
  capturedAt?: string;
  snapshotKey?: string;
};

/**
 * Public OSS provider contract (Set 0).
 * Providers emit *proposed* snapshots only — engine freezes authoritative rows.
 */
export interface EvidenceProvider {
  readonly capability: ProviderCapabilityProfile;
  resolve(input: EvidenceProviderResolveInput): Promise<Record<string, unknown> | null>;
  snapshot(input: EvidenceProviderSnapshotInput): Promise<EvidenceSnapshotProposed>;
}

export type ProviderRegistry = {
  register(provider: EvidenceProvider): void;
  get(providerId: string): EvidenceProvider | undefined;
  list(): EvidenceProvider[];
};

export function createProviderRegistry(): ProviderRegistry {
  const providers = new Map<string, EvidenceProvider>();

  return {
    register(provider) {
      const id = provider.capability.providerId;
      if (providers.has(id)) {
        throw new Error(`provider already registered: ${id}`);
      }
      providers.set(id, provider);
    },
    get(providerId) {
      return providers.get(providerId);
    },
    list() {
      return [...providers.values()];
    },
  };
}
