// SPDX-License-Identifier: Apache-2.0

/**
 * Fixture-only composition for docs, tests, and future Storybook (RT-06).
 * Does not fetch data or import database clients.
 */
import { mockStudioRunBundle } from "./fixtures/mock-run.js";
import { EvidencePanelFromResponse } from "./EvidencePanel.js";
import { LoopTimeline } from "./LoopTimeline.js";
import { ReplaySummaryPanel } from "./ReplaySummaryPanel.js";
import { RunHistoryPanelFromResponse } from "./RunHistoryPanel.js";
import { RunSummaryCardFromDetail } from "./RunSummaryCard.js";

export type StudioPrimitivesDemoProps = {
  className?: string;
};

export function StudioPrimitivesDemo({ className = "" }: StudioPrimitivesDemoProps) {
  const b = mockStudioRunBundle;

  return (
    <div
      className={`le-studio ${className}`.trim()}
      style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 960 }}
    >
      <RunSummaryCardFromDetail detail={b.detail} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <RunHistoryPanelFromResponse response={b.history} />
        <ReplaySummaryPanel summary={b.replaySummary} />
      </div>
      <LoopTimeline timeline={b.timeline.timeline} />
      <EvidencePanelFromResponse response={b.evidence} />
    </div>
  );
}
