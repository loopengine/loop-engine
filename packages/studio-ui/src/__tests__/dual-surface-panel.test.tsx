import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DualSurfaceEvidencePanel } from "../DualSurfaceEvidencePanel.js";
import { mockDualSurfaceRunBundle } from "../fixtures/mock-dual-surface-run.js";
import { mockRunDetail, mockRunEvidence, mockRunHistory } from "../fixtures/mock-run.js";

describe("DualSurfaceEvidencePanel (RT-15)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders work surface and Slack decision evidence for dual-surface runs", () => {
    render(
      <DualSurfaceEvidencePanel
        detail={mockDualSurfaceRunBundle.detail}
        evidence={mockDualSurfaceRunBundle.evidence}
        history={mockDualSurfaceRunBundle.history}
      />,
    );

    expect(screen.getByLabelText("Dual-surface evidence")).toBeTruthy();
    expect(screen.getByLabelText("Work surface")).toBeTruthy();
    expect(screen.getByLabelText("Decision surface")).toBeTruthy();
    expect(screen.getByText("1200")).toBeTruthy();
    expect(screen.getByText("Open in Slack")).toBeTruthy();
    expect(screen.getByText("Run history")).toBeTruthy();
  });

  it("shows empty state for non-dual-surface loops", () => {
    render(
      <DualSurfaceEvidencePanel
        detail={mockRunDetail}
        evidence={mockRunEvidence}
        history={mockRunHistory}
      />,
    );

    expect(screen.getByText(/not a dual-surface loop/i)).toBeTruthy();
  });
});
