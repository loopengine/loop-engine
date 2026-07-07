// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { loadGoldenExemplar } from "@loop-engine/golden-exemplars";
import { evidenceCardSummary, qualificationBadge } from "../index.js";

describe("presentation primitives", () => {
  it("renders P/D/F badge for E01 governed semantic metric", () => {
    const e01 = loadGoldenExemplar("E01")!;
    const badge = qualificationBadge(e01.snapshot.qualification);
    expect(badge.provenance.label).toBe("System attested");
    expect(badge.provenance.level).toBe("medium");
    expect(badge.definition.label).toBe("Governed");
  });

  it("builds evidence card summary", () => {
    const e10 = loadGoldenExemplar("E10")!;
    const card = evidenceCardSummary(e10.snapshot);
    expect(card.snapshotKey).toBe("manual-upload");
    expect(card.badge.provenance.level).toBe("low");
  });
});
