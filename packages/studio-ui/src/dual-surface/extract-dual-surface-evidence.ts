// SPDX-License-Identifier: Apache-2.0

import type { RunEvidenceItemDto } from "@loop-engine/observability";
import {
  CHANNEL_SLACK_CONNECTION_ID,
  INTEGRATION_GOOGLE_DOCS_CONNECTION_ID,
  INTEGRATION_GOOGLE_SHEETS_CONNECTION_ID,
} from "./constants.js";

export type DualSurfaceEvidenceContext = {
  sequence: number;
  eventId: string;
  transitionId: string | null;
  type: string;
  occurredAt: string;
};

export type SlackChannelEvidenceView = DualSurfaceEvidenceContext & {
  channelConnectionId: string;
  slackTeamId: string;
  slackChannelId: string;
  slackMessageTs: string;
  slackUserId?: string;
  slackActionId?: string;
  decisionSignalId?: string;
  slackThreadTs?: string;
};

export type GoogleDocsIntegrationEvidenceView = DualSurfaceEvidenceContext & {
  integrationConnectionId: string;
  googleConnectionId?: string;
  googleDocumentId: string;
  docContentSha256?: string;
  docSnapshotEvidenceId?: string;
  documentUrl?: string;
  revisionId?: string;
  decisionSignalId?: string;
};

export type GoogleSheetsIntegrationEvidenceView = DualSurfaceEvidenceContext & {
  integrationConnectionId: string;
  googleConnectionId?: string;
  spreadsheetId: string;
  spreadsheetUrl?: string;
  stagedEditId?: string;
  sheetName?: string;
  rangeA1?: string;
  proposedValue?: string;
  priorValue?: string;
  applyStatus?: string;
  appliedRanges?: number;
  decisionSignalId?: string;
};

export type DualSurfaceEvidenceExtract = {
  slackDecisions: SlackChannelEvidenceView[];
  googleDocs: GoogleDocsIntegrationEvidenceView[];
  googleSheets: GoogleSheetsIntegrationEvidenceView[];
  latestSlack?: SlackChannelEvidenceView;
  latestDocs?: GoogleDocsIntegrationEvidenceView;
  latestSheets?: GoogleSheetsIntegrationEvidenceView;
};

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

function readNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const value = obj[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function baseContext(item: RunEvidenceItemDto): DualSurfaceEvidenceContext {
  return {
    sequence: item.sequence,
    eventId: item.eventId,
    transitionId: item.transitionId,
    type: item.type,
    occurredAt: item.occurredAt,
  };
}

/**
 * Parse RT-05 evidence items for channel.slack and integration.google_* refs (RT-12–14).
 */
export function extractDualSurfaceEvidence(
  items: RunEvidenceItemDto[],
): DualSurfaceEvidenceExtract {
  const slackDecisions: SlackChannelEvidenceView[] = [];
  const googleDocs: GoogleDocsIntegrationEvidenceView[] = [];
  const googleSheets: GoogleSheetsIntegrationEvidenceView[] = [];

  for (const item of items) {
    const ctx = baseContext(item);

    const channel = readRecord(item.evidence.channel);
    if (channel) {
      const channelConnectionId =
        readString(channel, "channelConnectionId") ?? CHANNEL_SLACK_CONNECTION_ID;
      if (channelConnectionId === CHANNEL_SLACK_CONNECTION_ID) {
        const slackTeamId = readString(channel, "slackTeamId");
        const slackChannelId =
          readString(channel, "slackChannelId") ?? readString(channel, "channelId");
        const slackMessageTs =
          readString(channel, "slackMessageTs") ?? readString(channel, "messageTs");
        if (slackTeamId && slackChannelId && slackMessageTs) {
          slackDecisions.push({
            ...ctx,
            channelConnectionId,
            slackTeamId,
            slackChannelId,
            slackMessageTs,
            slackUserId: readString(channel, "slackUserId"),
            slackActionId: readString(channel, "slackActionId"),
            decisionSignalId: readString(channel, "decisionSignalId"),
            slackThreadTs: readString(channel, "slackThreadTs"),
          });
        }
      }
    }

    const integration = readRecord(item.evidence.integration);
    if (!integration) {
      continue;
    }

    const integrationConnectionId = readString(integration, "integrationConnectionId");
    if (integrationConnectionId === INTEGRATION_GOOGLE_DOCS_CONNECTION_ID) {
      const googleDocumentId =
        readString(integration, "googleDocumentId") ?? readString(integration, "documentId");
      if (googleDocumentId) {
        googleDocs.push({
          ...ctx,
          integrationConnectionId,
          googleConnectionId: readString(integration, "googleConnectionId"),
          googleDocumentId,
          docContentSha256: readString(integration, "docContentSha256"),
          docSnapshotEvidenceId: readString(integration, "docSnapshotEvidenceId"),
          documentUrl: readString(integration, "documentUrl"),
          revisionId: readString(integration, "revisionId"),
          decisionSignalId: readString(integration, "decisionSignalId"),
        });
      }
      continue;
    }

    if (integrationConnectionId === INTEGRATION_GOOGLE_SHEETS_CONNECTION_ID) {
      const spreadsheetId = readString(integration, "spreadsheetId");
      if (spreadsheetId) {
        googleSheets.push({
          ...ctx,
          integrationConnectionId,
          googleConnectionId: readString(integration, "googleConnectionId"),
          spreadsheetId,
          spreadsheetUrl: readString(integration, "spreadsheetUrl"),
          stagedEditId: readString(integration, "stagedEditId"),
          sheetName: readString(integration, "sheetName"),
          rangeA1: readString(integration, "rangeA1"),
          proposedValue: readString(integration, "proposedValue"),
          priorValue: readString(integration, "priorValue"),
          applyStatus: readString(integration, "applyStatus"),
          appliedRanges: readNumber(integration, "appliedRanges"),
          decisionSignalId: readString(integration, "decisionSignalId"),
        });
      }
    }
  }

  return {
    slackDecisions,
    googleDocs,
    googleSheets,
    latestSlack: slackDecisions.at(-1),
    latestDocs: googleDocs.at(-1),
    latestSheets: googleSheets.at(-1),
  };
}
