// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { buildCompletionBody, resolveTemperature } from "../src/sonar";
import { isSonarReasoningModel } from "../src/sonar-reasoning";
import type { PerplexityConfig } from "../src/types";

describe("sonar request builders", () => {
  const baseConfig: PerplexityConfig = {};

  it("resolveTemperature uses 0.2 for search-style models by default", () => {
    expect(resolveTemperature({ prompt: "x" }, "sonar-pro")).toBe(0.2);
  });

  it("resolveTemperature uses higher default for reasoning models", () => {
    expect(resolveTemperature({ prompt: "x" }, "sonar-reasoning")).toBe(0.3);
    expect(isSonarReasoningModel("sonar-reasoning-pro")).toBe(true);
  });

  it("respects explicit temperature override", () => {
    expect(resolveTemperature({ prompt: "x", temperature: 0.9 }, "sonar-reasoning")).toBe(0.9);
  });

  it("buildCompletionBody includes domain filter when provided", () => {
    const body = buildCompletionBody(
      {
        prompt: "q",
        metadata: { searchDomainFilter: ["fda.gov", "nih.gov"] }
      },
      baseConfig,
      "sonar-pro"
    );
    expect(body.search_domain_filter).toEqual(["fda.gov", "nih.gov"]);
  });
});
