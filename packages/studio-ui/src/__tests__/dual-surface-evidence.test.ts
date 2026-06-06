// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { extractDualSurfaceEvidence } from "../dual-surface/extract-dual-surface-evidence.js";
import { slackWebClientPermalink } from "../dual-surface/slack-permalink.js";
import {
  CHANNEL_SLACK_CONNECTION_ID,
  INTEGRATION_GOOGLE_DOCS_CONNECTION_ID,
  INTEGRATION_GOOGLE_SHEETS_CONNECTION_ID,
  isDualSurfaceLoop,
} from "../dual-surface/constants.js";
import {
  mockDualSurfaceDocHistoryEvent,
  mockDualSurfaceRunEvidence,
} from "../fixtures/mock-dual-surface-run.js";

describe("extractDualSurfaceEvidence (RT-15)", () => {
  it("detects dual-surface loop ids", () => {
    expect(isDualSurfaceLoop("dual-surface.spreadsheet-approval")).toBe(true);
    expect(isDualSurfaceLoop("demo.commerce-discovery")).toBe(false);
  });

  it("extracts Slack, Sheets, and Docs evidence from RT-05 items", () => {
    const extracted = extractDualSurfaceEvidence(mockDualSurfaceRunEvidence.items);
    expect(extracted.slackDecisions).toHaveLength(1);
    expect(extracted.googleSheets).toHaveLength(2);
    expect(extracted.latestSlack?.channelConnectionId).toBe(CHANNEL_SLACK_CONNECTION_ID);
    expect(extracted.googleSheets[0]?.proposedValue).toBe("1200");
    expect(extracted.latestSheets?.applyStatus).toBe("applied");
  });

  it("extracts Google Docs integration evidence", () => {
    const extracted = extractDualSurfaceEvidence([
      {
        sequence: mockDualSurfaceDocHistoryEvent.sequence,
        eventId: mockDualSurfaceDocHistoryEvent.eventId,
        transitionId: mockDualSurfaceDocHistoryEvent.transitionId,
        type: mockDualSurfaceDocHistoryEvent.type,
        occurredAt: mockDualSurfaceDocHistoryEvent.occurredAt,
        evidence: mockDualSurfaceDocHistoryEvent.evidence,
      },
    ]);
    expect(extracted.googleDocs).toHaveLength(1);
    expect(extracted.latestDocs?.integrationConnectionId).toBe(
      INTEGRATION_GOOGLE_DOCS_CONNECTION_ID,
    );
    expect(extracted.latestDocs?.googleDocumentId).toBe("doc-abc");
  });

  it("builds Slack permalinks without secrets", () => {
    expect(slackWebClientPermalink("T1", "C1", "123.456")).toBe(
      "https://app.slack.com/client/T1/C1/p123456",
    );
  });

  it("ignores unknown integration connection ids", () => {
    const extracted = extractDualSurfaceEvidence([
      {
        sequence: 0,
        eventId: "x",
        transitionId: null,
        type: "transition.completed",
        occurredAt: "2026-05-01T00:00:00.000Z",
        evidence: {
          integration: {
            integrationConnectionId: "integration.unknown",
            spreadsheetId: "nope",
          },
        },
      },
    ]);
    expect(extracted.googleSheets).toHaveLength(0);
    expect(extracted.googleDocs).toHaveLength(0);
  });
});
