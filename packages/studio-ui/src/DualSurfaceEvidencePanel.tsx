// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react";
import type {
  RunDetailReadResponse,
  RunEvidenceReadResponse,
  RunHistoryReadResponse,
} from "@loop-engine/observability";
import { RunHistoryPanel } from "./RunHistoryPanel.js";
import { StudioStateFrame, type StudioViewStatus } from "./StudioStateFrame.js";
import { isDualSurfaceLoop } from "./dual-surface/constants.js";
import {
  extractDualSurfaceEvidence,
  type GoogleDocsIntegrationEvidenceView,
  type GoogleSheetsIntegrationEvidenceView,
  type SlackChannelEvidenceView,
} from "./dual-surface/extract-dual-surface-evidence.js";
import { slackWebClientPermalink } from "./dual-surface/slack-permalink.js";
import { formatIsoTimestamp } from "./utils.js";

export type DualSurfaceEvidencePanelProps = {
  detail: RunDetailReadResponse;
  evidence: RunEvidenceReadResponse;
  history: RunHistoryReadResponse;
  status?: StudioViewStatus;
  className?: string;
};

function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return (
    <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.35rem" }}>
      <span className="le-studio-muted" style={{ minWidth: "7rem" }}>
        {label}
      </span>
      <span style={{ wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function SlackDecisionSection({ items }: { items: SlackChannelEvidenceView[] }) {
  if (items.length === 0) {
    return (
      <p className="le-studio-muted" style={{ margin: 0 }}>
        No Slack channel evidence on this run yet.
      </p>
    );
  }

  return (
    <ul className="le-studio-list">
      {items.map((item) => {
        const href = slackWebClientPermalink(
          item.slackTeamId,
          item.slackChannelId,
          item.slackMessageTs,
        );
        return (
          <li key={item.eventId}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <strong>#{item.sequence}</strong>
              <span className="le-studio-muted">{formatIsoTimestamp(item.occurredAt)}</span>
            </div>
            <FieldRow label="Signal" value={item.decisionSignalId ?? item.transitionId} />
            <FieldRow label="Team" value={item.slackTeamId} />
            <FieldRow label="Channel" value={item.slackChannelId} />
            <FieldRow label="Message ts" value={item.slackMessageTs} />
            <FieldRow label="Decider" value={item.slackUserId} />
            <p style={{ margin: "0.5rem 0 0" }}>
              <a href={href} target="_blank" rel="noopener noreferrer">
                Open in Slack
              </a>
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function GoogleDocsSection({ items }: { items: GoogleDocsIntegrationEvidenceView[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="le-studio-card" aria-label="Google Docs integration evidence">
      <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Google Docs</h4>
      <ul className="le-studio-list">
        {items.map((item) => (
          <li key={item.eventId}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <strong>#{item.sequence}</strong>
              <span className="le-studio-muted">{formatIsoTimestamp(item.occurredAt)}</span>
            </div>
            <FieldRow label="Document" value={item.googleDocumentId} />
            <FieldRow label="Content hash" value={item.docContentSha256} />
            <FieldRow label="Snapshot id" value={item.docSnapshotEvidenceId} />
            <FieldRow label="Signal" value={item.decisionSignalId ?? item.transitionId} />
            {item.documentUrl ? (
              <p style={{ margin: "0.5rem 0 0" }}>
                <a href={item.documentUrl} target="_blank" rel="noopener noreferrer">
                  Open document
                </a>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function GoogleSheetsSection({ items }: { items: GoogleSheetsIntegrationEvidenceView[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="le-studio-card" aria-label="Google Sheets integration evidence">
      <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Google Sheets</h4>
      <ul className="le-studio-list">
        {items.map((item) => (
          <li key={item.eventId}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <strong>#{item.sequence}</strong>
              <span className="le-studio-muted">{formatIsoTimestamp(item.occurredAt)}</span>
            </div>
            <FieldRow label="Spreadsheet" value={item.spreadsheetId} />
            <FieldRow label="Staged edit" value={item.stagedEditId} />
            <FieldRow label="Range" value={item.rangeA1} />
            <FieldRow label="Proposed" value={item.proposedValue} />
            <FieldRow label="Prior" value={item.priorValue} />
            <FieldRow label="Apply status" value={item.applyStatus} />
            <FieldRow label="Signal" value={item.decisionSignalId ?? item.transitionId} />
            {item.spreadsheetUrl ? (
              <p style={{ margin: "0.5rem 0 0" }}>
                <a href={item.spreadsheetUrl} target="_blank" rel="noopener noreferrer">
                  Open spreadsheet
                </a>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DualSurfaceEvidencePanel({
  detail,
  evidence,
  history,
  status = "ready",
  className = "",
}: DualSurfaceEvidencePanelProps) {
  const loopId = detail.run.loopId;

  if (!isDualSurfaceLoop(loopId)) {
    return (
      <StudioStateFrame
        status="empty"
        emptyLabel="This run is not a dual-surface loop (loopId must start with dual-surface.)."
        className={className}
      />
    );
  }

  const extracted = extractDualSurfaceEvidence(evidence.items);
  const hasWorkSurface = extracted.googleDocs.length > 0 || extracted.googleSheets.length > 0;
  const hasDecisionSurface = extracted.slackDecisions.length > 0;
  const hasAnyStructured = hasWorkSurface || hasDecisionSurface;

  return (
    <StudioStateFrame
      status={!hasAnyStructured && status === "ready" ? "empty" : status}
      emptyLabel="No dual-surface channel or integration evidence on this run yet."
      className={className}
    >
      <section className="le-studio-card" aria-label="Dual-surface evidence">
        <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>Dual-surface evidence</h3>
        <p className="le-studio-muted" style={{ margin: "0 0 1rem", fontSize: "0.875rem" }}>
          Read-only view from RT-05 evidence APIs — channel ({`channel.slack`}) and integration (
          {`integration.google_docs`}, {`integration.google_sheets`}).
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <section className="le-studio-card" aria-label="Work surface">
            <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Work surface</h4>
            {!hasWorkSurface ? (
              <p className="le-studio-muted" style={{ margin: 0 }}>
                No Google Docs or Sheets integration evidence yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <GoogleDocsSection items={extracted.googleDocs} />
                <GoogleSheetsSection items={extracted.googleSheets} />
              </div>
            )}
          </section>

          <section className="le-studio-card" aria-label="Decision surface">
            <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Decision surface (Slack)</h4>
            <SlackDecisionSection items={extracted.slackDecisions} />
          </section>
        </div>

        <RunHistoryPanel events={history.events} />
      </section>
    </StudioStateFrame>
  );
}
