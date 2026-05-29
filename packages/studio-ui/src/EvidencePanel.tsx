// SPDX-License-Identifier: Apache-2.0

import type { RunEvidenceItemDto, RunEvidenceReadResponse } from "@loop-engine/observability";
import { formatIsoTimestamp } from "./utils.js";
import { StudioStateFrame, type StudioViewStatus } from "./StudioStateFrame.js";

export type EvidencePanelProps = {
  items: RunEvidenceItemDto[];
  status?: StudioViewStatus;
  emptyLabel?: string;
  errorMessage?: string;
  className?: string;
};

function EvidenceItemRow({ item }: { item: RunEvidenceItemDto }) {
  const keys = Object.keys(item.evidence);
  return (
    <li>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
        <span>
          <strong>#{item.sequence}</strong> {item.type}
          {item.transitionId ? (
            <span className="le-studio-muted"> · {item.transitionId}</span>
          ) : null}
        </span>
        <span className="le-studio-muted">{formatIsoTimestamp(item.occurredAt)}</span>
      </div>
      {keys.length === 0 ? (
        <p className="le-studio-muted" style={{ margin: "0.5rem 0 0" }}>
          (empty evidence)
        </p>
      ) : (
        <pre
          style={{
            margin: "0.5rem 0 0",
            padding: "0.5rem",
            background: "var(--le-studio-surface)",
            borderRadius: 4,
            fontSize: "0.75rem",
            overflow: "auto",
          }}
        >
          {JSON.stringify(item.evidence, null, 2)}
        </pre>
      )}
    </li>
  );
}

export function EvidencePanel({
  items,
  status = "ready",
  emptyLabel = "No evidence for this run",
  errorMessage,
  className = "",
}: EvidencePanelProps) {
  return (
    <StudioStateFrame
      status={items.length === 0 && status === "ready" ? "empty" : status}
      emptyLabel={emptyLabel}
      errorMessage={errorMessage}
      className={className}
    >
      <section className="le-studio-card" aria-label="Evidence">
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Evidence</h3>
        <ul className="le-studio-list">
          {items.map((item) => (
            <EvidenceItemRow key={item.eventId} item={item} />
          ))}
        </ul>
      </section>
    </StudioStateFrame>
  );
}

export function EvidencePanelFromResponse({
  response,
  status = "ready",
  className,
}: {
  response: RunEvidenceReadResponse;
  status?: StudioViewStatus;
  className?: string;
}) {
  return <EvidencePanel items={response.items} status={status} className={className} />;
}
