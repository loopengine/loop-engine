// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import {
  definitionMeetsMinimum,
  provenanceMeetsMinimum,
} from "../qualification.js";
import { validateEvidenceSnapshotProposed } from "../validate-provider-snapshot.js";
import { LAUNCH_DECISION_RECORD_VERSIONS } from "../types.js";

const baseSnapshot = {
  snapshotKey: "metric-total",
  sourceSystem: "warehouse",
  sourceRef: "semantic://revenue_total",
  capturedAt: "2026-07-07T12:00:00.000Z",
  capturedBy: "provider-json",
  values: { amount: 12500, currency: "USD" },
  versions: LAUNCH_DECISION_RECORD_VERSIONS,
  qualification: {
    provenance: "system-attested",
    definition: "governed",
    freshness: {
      applicable: "applicable",
      snapshotFrozenAt: "2026-07-07T12:00:00.000Z",
      valueAsOf: "2026-07-07T11:58:00.000Z",
      bindingClock: "valueAsOf",
      freshnessVerdict: "fresh",
    },
  },
};

describe("qualification vector ordering", () => {
  it("compares provenance rungs with ≥ semantics", () => {
    expect(provenanceMeetsMinimum("origin-attested", "system-attested")).toBe(true);
    expect(provenanceMeetsMinimum("unknown", "system-attested")).toBe(false);
  });

  it("skips definition check when axis is not-applicable", () => {
    expect(definitionMeetsMinimum("not-applicable", "governed")).toBe(true);
    expect(definitionMeetsMinimum("governed", "not-applicable")).toBe(true);
  });
});

describe("validateEvidenceSnapshotProposed (Set 0)", () => {
  it("accepts a governed semantic metric exemplar shape", () => {
    expect(validateEvidenceSnapshotProposed(baseSnapshot).valid).toBe(true);
  });

  it("rejects missing qualification vector", () => {
    const result = validateEvidenceSnapshotProposed({
      ...baseSnapshot,
      qualification: undefined,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects applicable freshness without clocks", () => {
    const result = validateEvidenceSnapshotProposed({
      ...baseSnapshot,
      qualification: {
        ...baseSnapshot.qualification,
        freshness: { applicable: "applicable" },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path?.includes("snapshotFrozenAt"))).toBe(true);
  });
});
