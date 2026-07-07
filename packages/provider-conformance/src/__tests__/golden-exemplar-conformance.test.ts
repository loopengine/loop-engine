// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import {
  assertGoldenExemplarSuitePasses,
  runGoldenExemplarConformanceSuite,
  runConformanceChecks,
} from "../index.js";
import { loadGoldenExemplars, LOADED_EXEMPLAR_IDS } from "@loop-engine/golden-exemplars";

describe("provider conformance suite (Set 0.5)", () => {
  it("loads all E01–E10 exemplar fixtures", () => {
    expect(LOADED_EXEMPLAR_IDS).toHaveLength(10);
    expect(loadGoldenExemplars().map((row) => row.id)).toEqual([...LOADED_EXEMPLAR_IDS]);
  });

  it("passes structural + hash checks for all loaded exemplars", () => {
    const reports = runGoldenExemplarConformanceSuite();
    expect(reports.every((report) => report.valid)).toBe(true);
  });

  it("assertGoldenExemplarSuitePasses does not throw", () => {
    expect(() => assertGoldenExemplarSuitePasses()).not.toThrow();
  });

  it("flags false governance mapping for E02 ad-hoc query", () => {
    const e02 = loadGoldenExemplars().find((row) => row.id === "E02")!;
    const governedE02 = {
      ...e02.snapshot,
      qualification: {
        ...e02.snapshot.qualification,
        definition: "governed" as const,
      },
    };
    const structural = runConformanceChecks(governedE02, { exemplarId: "E02" });
    expect(structural.valid).toBe(true);
    const suite = runGoldenExemplarConformanceSuite();
    expect(suite.find((r) => r.exemplarId === "E02")?.valid).toBe(true);
  });
});
