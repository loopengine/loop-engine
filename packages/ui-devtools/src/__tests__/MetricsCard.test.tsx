// @license MIT
// SPDX-License-Identifier: MIT
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricsCard } from "../components/MetricsCard";

describe("MetricsCard", () => {
  it("renders core metric labels", () => {
    render(
      <MetricsCard
        metrics={{
          loopId: "demo.loop" as never,
          period: { from: "a", to: "b" },
          totalInstances: 1,
          openInstances: 0,
          closedInstances: 1,
          errorInstances: 0,
          avgDurationMs: 1000,
          medianDurationMs: 1000,
          p95DurationMs: 1000,
          completionRate: 1,
          guardFailureRate: 0,
          aiActorRate: 0.2,
          humanActorRate: 0.8,
          avgTransitionCount: 2
        }}
      />
    );
    expect(screen.getByText("Completion Rate")).toBeDefined();
  });
});
