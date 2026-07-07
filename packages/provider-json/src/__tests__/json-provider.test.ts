// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { loadGoldenExemplar } from "@loop-engine/golden-exemplars";
import { runConformanceChecks } from "@loop-engine/provider-conformance";
import { createJsonEvidenceProvider } from "../index.js";

describe("createJsonEvidenceProvider", () => {
  it("resolves and snapshots golden exemplar E01 by sourceRef", async () => {
    const e01 = loadGoldenExemplar("E01")!;
    const provider = createJsonEvidenceProvider({
      providerId: "provider-json",
      displayName: "JSON reference provider",
      role: "source",
      archetype: "semantic",
      entries: [
        {
          sourceRef: e01.snapshot.sourceRef!,
          resolve: { metric: "revenue_total" },
          snapshot: e01.snapshot,
        },
      ],
    });

    const resolved = await provider.resolve({ sourceRef: e01.snapshot.sourceRef! });
    expect(resolved).toEqual({ metric: "revenue_total" });

    const snapshot = await provider.snapshot({
      sourceRef: e01.snapshot.sourceRef!,
      capturedBy: "provider-json",
    });

    const report = runConformanceChecks(snapshot, { exemplarId: "E01" });
    expect(report.valid).toBe(true);
    expect(snapshot.qualification.definition).toBe("governed");
    expect(snapshot.contentSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws for unknown sourceRef", async () => {
    const provider = createJsonEvidenceProvider({
      providerId: "provider-json",
      displayName: "JSON reference provider",
      entries: [],
    });

    await expect(
      provider.snapshot({ sourceRef: "missing://ref", capturedBy: "test" }),
    ).rejects.toThrow(/unknown sourceRef/);
  });
});
