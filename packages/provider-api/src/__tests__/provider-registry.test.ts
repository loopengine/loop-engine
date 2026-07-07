// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { createProviderRegistry, type EvidenceProvider } from "../index.js";
import {
  LAUNCH_DECISION_RECORD_VERSIONS,
  type EvidenceSnapshotProposed,
} from "@loop-engine/evidence";

function stubProvider(id: string): EvidenceProvider {
  return {
    capability: {
      providerId: id,
      displayName: id,
      role: "source",
      archetype: "manual",
      provenanceCeiling: "unknown",
      definitionCeiling: "not-applicable",
      freshnessSupported: false,
      suppliesLineage: false,
      suppliesVersion: false,
      suppliesMeasurements: false,
      conformanceSuiteVersion: "provider-conformance-0.1.0",
    },
    async resolve() {
      return { ok: true };
    },
    async snapshot(): Promise<EvidenceSnapshotProposed> {
      return {
        snapshotKey: "stub",
        sourceSystem: id,
        capturedAt: "2026-07-07T12:00:00.000Z",
        capturedBy: "test",
        values: { ok: true },
        versions: LAUNCH_DECISION_RECORD_VERSIONS,
        qualification: {
          provenance: "unknown",
          definition: "not-applicable",
          freshness: { applicable: "not-applicable" },
        },
        providerId: id,
        conformanceSuiteVersion: "provider-conformance-0.1.0",
      };
    },
  };
}

describe("createProviderRegistry", () => {
  it("registers and retrieves providers by id", () => {
    const registry = createProviderRegistry();
    registry.register(stubProvider("manual.demo"));
    expect(registry.get("manual.demo")?.capability.role).toBe("source");
    expect(registry.list()).toHaveLength(1);
  });

  it("rejects duplicate provider ids", () => {
    const registry = createProviderRegistry();
    registry.register(stubProvider("dup"));
    expect(() => registry.register(stubProvider("dup"))).toThrow(/already registered/);
  });
});
