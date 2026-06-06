// SPDX-License-Identifier: Apache-2.0
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StudioPrimitivesDemo } from "../StudioPrimitivesDemo.js";
import { RunSummaryCard } from "../RunSummaryCard.js";
import { StudioStateFrame } from "../StudioStateFrame.js";
import { mockRunDetail } from "../fixtures/mock-run.js";

describe("studio-ui components", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders run summary card from mock fixture", () => {
    render(<RunSummaryCard run={mockRunDetail.run} traceStepCount={mockRunDetail.traceStepCount} />);
    expect(screen.getByText("demo.commerce-discovery")).toBeTruthy();
    expect(screen.getByText("run_demo_01")).toBeTruthy();
    expect(screen.getByText("Governed")).toBeTruthy();
  });

  it("renders loading state frame", () => {
    render(<StudioStateFrame status="loading" />);
    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  it("renders demo composition without crashing", () => {
    render(<StudioPrimitivesDemo />);
    expect(screen.getAllByLabelText("Run summary").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Evidence")).toBeTruthy();
    expect(screen.getByLabelText("Replay summary")).toBeTruthy();
    expect(screen.getByLabelText("Loop timeline")).toBeTruthy();
  });
});
