// SPDX-License-Identifier: Apache-2.0

import type { RunReplaySummaryReadResponse } from "@loop-engine/observability";
import { StudioStateFrame, type StudioViewStatus } from "./StudioStateFrame.js";
import { formatDurationMs } from "./utils.js";

export type ReplaySummaryPanelProps = {
  summary: RunReplaySummaryReadResponse;
  status?: StudioViewStatus;
  errorMessage?: string;
  className?: string;
};

export function ReplaySummaryPanel({
  summary,
  status = "ready",
  errorMessage,
  className = "",
}: ReplaySummaryPanelProps) {
  const { metrics } = summary;

  return (
    <StudioStateFrame
      status={status}
      {...(errorMessage !== undefined ? { errorMessage } : {})}
      className={className}
    >
      <section className="le-studio-card" aria-label="Replay summary">
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Replay summary</h3>
        <p className="le-studio-muted" style={{ margin: "0 0 1rem" }}>
          HTTP replay analysis uses persisted traces; in-memory{" "}
          <code>replayLoopFromTrace</code> validates sequence only.
        </p>
        <dl className="le-studio-grid-2" style={{ margin: 0 }}>
          <div>
            <dt className="le-studio-muted">Transitions</dt>
            <dd style={{ margin: 0 }}>{summary.transitionCount}</dd>
          </div>
          <div>
            <dt className="le-studio-muted">Guard blocks</dt>
            <dd style={{ margin: 0 }}>{summary.guardBlockCount}</dd>
          </div>
          <div>
            <dt className="le-studio-muted">Human approvals</dt>
            <dd style={{ margin: 0 }}>{summary.humanApprovalCount}</dd>
          </div>
          <div>
            <dt className="le-studio-muted">Duration</dt>
            <dd style={{ margin: 0 }}>{formatDurationMs(metrics.totalDurationMs)}</dd>
          </div>
          <div>
            <dt className="le-studio-muted">Terminal</dt>
            <dd style={{ margin: 0 }}>{summary.terminalState ?? "—"}</dd>
          </div>
          <div>
            <dt className="le-studio-muted">Sequence valid</dt>
            <dd style={{ margin: 0 }}>
              {summary.sequenceValid ? (
                <span className="le-studio-badge" style={{ borderColor: "var(--le-studio-success)", color: "var(--le-studio-success)" }}>
                  Yes
                </span>
              ) : (
                <span className="le-studio-badge le-studio-badge--blocked">
                  No{summary.invalidAtSequence !== null ? ` @ ${summary.invalidAtSequence}` : ""}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>
    </StudioStateFrame>
  );
}
