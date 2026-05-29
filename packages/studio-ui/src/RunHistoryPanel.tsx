// SPDX-License-Identifier: Apache-2.0

import type { RunAuditEventDto, RunHistoryReadResponse } from "@loop-engine/observability";
import { ActorAttribution } from "./ActorAttribution.js";
import { StudioStateFrame, type StudioViewStatus } from "./StudioStateFrame.js";
import { formatIsoTimestamp } from "./utils.js";

export type RunHistoryPanelProps = {
  events: RunAuditEventDto[];
  status?: StudioViewStatus;
  emptyLabel?: string;
  errorMessage?: string;
  className?: string;
};

export function RunHistoryPanel({
  events,
  status = "ready",
  emptyLabel = "No audit events",
  errorMessage,
  className = "",
}: RunHistoryPanelProps) {
  return (
    <StudioStateFrame
      status={events.length === 0 && status === "ready" ? "empty" : status}
      emptyLabel={emptyLabel}
      {...(errorMessage !== undefined ? { errorMessage } : {})}
      className={className}
    >
      <section className="le-studio-card" aria-label="Run history">
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Run history</h3>
        <ul className="le-studio-list">
          {events.map((e) => (
            <li key={e.eventId}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <span>
                  <strong>#{e.sequence}</strong> {e.type}
                  {e.fromState || e.toState ? (
                    <span className="le-studio-muted">
                      {" "}
                      {e.fromState ?? "∅"} → {e.toState ?? "∅"}
                    </span>
                  ) : null}
                </span>
                <span className="le-studio-muted">{formatIsoTimestamp(e.occurredAt)}</span>
              </div>
              <div style={{ marginTop: "0.35rem" }}>
                <ActorAttribution id={e.actor.id} type={e.actor.type} />
                {e.blocked ? (
                  <span className="le-studio-badge le-studio-badge--blocked" style={{ marginLeft: "0.5rem" }}>
                    Blocked{e.blockReason ? `: ${e.blockReason}` : ""}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </StudioStateFrame>
  );
}

export function RunHistoryPanelFromResponse({
  response,
  status = "ready",
  className = "",
}: {
  response: RunHistoryReadResponse;
  status?: StudioViewStatus;
  className?: string;
}) {
  return <RunHistoryPanel events={response.events} status={status} className={className} />;
}
