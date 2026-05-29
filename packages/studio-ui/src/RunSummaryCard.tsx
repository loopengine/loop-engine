// SPDX-License-Identifier: Apache-2.0

import type { RunDetailReadResponse, RunReadSummaryDto } from "@loop-engine/observability";
import { formatDurationMs, formatIsoTimestamp } from "./utils.js";

export type RunSummaryCardProps = {
  run: RunReadSummaryDto;
  traceStepCount?: number;
  contractVersion?: string;
  className?: string;
};

export function RunSummaryCard({
  run,
  traceStepCount,
  contractVersion,
  className = "",
}: RunSummaryCardProps) {
  const started = formatIsoTimestamp(run.startedAt);
  const completed = run.completedAt ? formatIsoTimestamp(run.completedAt) : "In progress";
  const duration =
    run.completedAt && run.startedAt
      ? formatDurationMs(new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime())
      : "—";

  return (
    <section className={`le-studio le-studio-card ${className}`.trim()} aria-label="Run summary">
      <header style={{ marginBottom: "0.75rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>{run.loopId}</h3>
        <p className="le-studio-muted" style={{ margin: "0.25rem 0 0" }}>
          {run.loopRunId}
        </p>
      </header>
      <dl className="le-studio-grid-2" style={{ margin: 0 }}>
        <div>
          <dt className="le-studio-muted">Started</dt>
          <dd style={{ margin: 0 }}>{started}</dd>
        </div>
        <div>
          <dt className="le-studio-muted">Completed</dt>
          <dd style={{ margin: 0 }}>{completed}</dd>
        </div>
        <div>
          <dt className="le-studio-muted">Duration</dt>
          <dd style={{ margin: 0 }}>{duration}</dd>
        </div>
        <div>
          <dt className="le-studio-muted">Terminal state</dt>
          <dd style={{ margin: 0 }}>{run.terminalState ?? "—"}</dd>
        </div>
        <div>
          <dt className="le-studio-muted">Steps</dt>
          <dd style={{ margin: 0 }}>{run.stepCount}</dd>
        </div>
        <div>
          <dt className="le-studio-muted">Blocked</dt>
          <dd style={{ margin: 0 }}>{run.blockedCount}</dd>
        </div>
      </dl>
      <footer style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {run.governed ? (
          <span className="le-studio-badge le-studio-badge--governed">Governed</span>
        ) : null}
        {run.blockedCount > 0 ? (
          <span className="le-studio-badge le-studio-badge--blocked">Had blocks</span>
        ) : null}
        {traceStepCount !== undefined ? (
          <span className="le-studio-badge">{traceStepCount} trace steps</span>
        ) : null}
        {contractVersion ? (
          <span className="le-studio-badge">{contractVersion}</span>
        ) : null}
      </footer>
    </section>
  );
}

export function RunSummaryCardFromDetail({
  detail,
  className,
}: {
  detail: RunDetailReadResponse;
  className?: string;
}) {
  return (
    <RunSummaryCard
      run={detail.run}
      traceStepCount={detail.traceStepCount}
      contractVersion={detail.contractVersion}
      className={className}
    />
  );
}
