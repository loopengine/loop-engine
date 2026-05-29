// SPDX-License-Identifier: Apache-2.0

import type { TraceLoopTimeline } from "@loop-engine/observability";
import { ActorAttribution } from "./ActorAttribution.js";
import { GuardResultList } from "./GuardResultList.js";
import { StudioStateFrame, type StudioViewStatus } from "./StudioStateFrame.js";
import { formatDurationMs, formatIsoTimestamp } from "./utils.js";

export type LoopTimelineProps = {
  timeline: TraceLoopTimeline;
  status?: StudioViewStatus;
  emptyLabel?: string;
  errorMessage?: string;
  className?: string;
};

export function LoopTimeline({
  timeline,
  status = "ready",
  emptyLabel = "No transitions recorded",
  errorMessage,
  className = "",
}: LoopTimelineProps) {
  const transitions = timeline.transitions;

  return (
    <StudioStateFrame
      status={transitions.length === 0 && status === "ready" ? "empty" : status}
      emptyLabel={emptyLabel}
      {...(errorMessage !== undefined ? { errorMessage } : {})}
      className={className}
    >
      <section className="le-studio-card" aria-label="Loop timeline">
        <header style={{ marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Timeline</h3>
          <p className="le-studio-muted" style={{ margin: "0.25rem 0 0" }}>
            {timeline.loopId} · {formatIsoTimestamp(timeline.startedAt)}
            {timeline.completedAt ? ` → ${formatIsoTimestamp(timeline.completedAt)}` : ""}
          </p>
        </header>

        <ol className="le-studio-list" style={{ listStyle: "none" }}>
          {transitions.map((t) => (
            <li key={`${t.transitionId}-${t.timestamp}`} className="le-studio-timeline-step">
              <div className="le-studio-muted">{formatIsoTimestamp(t.timestamp)}</div>
              <div>
                <div>
                  <strong>
                    {t.from} → {t.to}
                  </strong>{" "}
                  <span className="le-studio-muted">({t.transitionId})</span>
                </div>
                <div style={{ marginTop: "0.35rem" }}>
                  <ActorAttribution id={t.actor.id} type={t.actor.type} />
                </div>
                {t.guardResults && t.guardResults.length > 0 ? (
                  <div style={{ marginTop: "0.5rem" }}>
                    <GuardResultList guards={t.guardResults} />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        {timeline.stateResidency.length > 0 ? (
          <div style={{ marginTop: "1rem" }}>
            <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem" }}>State residency</h4>
            <ul className="le-studio-list">
              {timeline.stateResidency.map((r) => (
                <li key={r.state}>
                  <strong>{r.state}</strong>
                  <span className="le-studio-muted">
                    {" "}
                    {formatIsoTimestamp(r.enteredAt)}
                    {r.exitedAt ? ` → ${formatIsoTimestamp(r.exitedAt)}` : " (open)"}
                    {r.durationMs !== null ? ` · ${formatDurationMs(r.durationMs)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </StudioStateFrame>
  );
}
