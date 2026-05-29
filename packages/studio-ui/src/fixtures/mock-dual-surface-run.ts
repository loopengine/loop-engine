// SPDX-License-Identifier: Apache-2.0

import {
  RUNTIME_API_CONTRACT_VERSION,
  type RunDetailReadResponse,
  type RunEvidenceReadResponse,
  type RunHistoryReadResponse,
  type RunReplaySummaryReadResponse,
  type RunTimelineReadResponse,
} from "@loop-engine/observability";
import {
  CHANNEL_SLACK_CONNECTION_ID,
  INTEGRATION_GOOGLE_DOCS_CONNECTION_ID,
  INTEGRATION_GOOGLE_SHEETS_CONNECTION_ID,
} from "../dual-surface/constants.js";

export const DUAL_SURFACE_LOOP_ID = "dual-surface.spreadsheet-approval";
export const DUAL_SURFACE_RUN_ID = "run_dual_surface_01";

export const mockDualSurfaceRunDetail: RunDetailReadResponse = {
  contractVersion: RUNTIME_API_CONTRACT_VERSION,
  run: {
    loopRunId: DUAL_SURFACE_RUN_ID,
    loopId: DUAL_SURFACE_LOOP_ID,
    startedAt: "2026-05-01T11:00:00.000Z",
    completedAt: "2026-05-01T11:10:00.000Z",
    terminalState: "CLOSED",
    stepCount: 4,
    blockedCount: 0,
    governed: true,
  },
  traceStepCount: 4,
  readSurfaces: {
    history: `/api/v1/runs/${DUAL_SURFACE_RUN_ID}/history`,
    evidence: `/api/v1/runs/${DUAL_SURFACE_RUN_ID}/evidence`,
    timeline: `/api/v1/runs/${DUAL_SURFACE_RUN_ID}/timeline`,
    replaySummary: `/api/v1/runs/${DUAL_SURFACE_RUN_ID}/replay-summary`,
    legacyTrace: `/api/v1/loops/runs/${DUAL_SURFACE_RUN_ID}`,
  },
};

export const mockDualSurfaceRunHistory: RunHistoryReadResponse = {
  contractVersion: RUNTIME_API_CONTRACT_VERSION,
  loopRunId: DUAL_SURFACE_RUN_ID,
  loopId: DUAL_SURFACE_LOOP_ID,
  events: [
    {
      eventId: "ds-0",
      sequence: 0,
      type: "loop.started",
      fromState: null,
      toState: "OPEN",
      transitionId: null,
      actor: { id: "system:boot", type: "system" },
      evidence: {},
      occurredAt: "2026-05-01T11:00:00.000Z",
      blocked: false,
      blockReason: null,
    },
    {
      eventId: "ds-1",
      sequence: 1,
      type: "transition.completed",
      fromState: "SHEET_STAGED",
      toState: "PENDING_APPROVAL",
      transitionId: "dual_surface.sheets.submitted_for_approval.v1",
      actor: { id: "user:sheet-1", type: "human" },
      evidence: {
        integration: {
          integrationConnectionId: INTEGRATION_GOOGLE_SHEETS_CONNECTION_ID,
          integrationKind: "google_sheets",
          spreadsheetId: "sheet-abc",
          spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-abc/edit",
          stagedEditId: "stage-1",
          rangeA1: "'Budget'!D3",
          proposedValue: "1200",
          priorValue: "900",
          applyStatus: "pending",
          decisionSignalId: "dual_surface.sheets.submitted_for_approval.v1",
        },
      },
      occurredAt: "2026-05-01T11:05:00.000Z",
      blocked: false,
      blockReason: null,
    },
    {
      eventId: "ds-2",
      sequence: 2,
      type: "transition.completed",
      fromState: "PENDING_APPROVAL",
      toState: "APPROVED",
      transitionId: "dual_surface.slack.interactive.approve.v1",
      actor: { id: "user:slack-1", type: "human" },
      evidence: {
        note: "LGTM",
        channel: {
          channelConnectionId: CHANNEL_SLACK_CONNECTION_ID,
          channelKind: "slack",
          slackTeamId: "T1",
          slackChannelId: "C1",
          slackMessageTs: "123.456",
          slackUserId: "U1",
          decisionSignalId: "dual_surface.slack.interactive.approve.v1",
        },
      },
      occurredAt: "2026-05-01T11:08:00.000Z",
      blocked: false,
      blockReason: null,
    },
    {
      eventId: "ds-3",
      sequence: 3,
      type: "transition.completed",
      fromState: "APPROVED",
      toState: "CLOSED",
      transitionId: "dual_surface.sheets.apply_completed.v1",
      actor: { id: "user:sheet-1", type: "human" },
      evidence: {
        integration: {
          integrationConnectionId: INTEGRATION_GOOGLE_SHEETS_CONNECTION_ID,
          integrationKind: "google_sheets",
          spreadsheetId: "sheet-abc",
          stagedEditId: "stage-1",
          applyStatus: "applied",
          appliedRanges: 1,
          decisionSignalId: "dual_surface.sheets.apply_completed.v1",
        },
      },
      occurredAt: "2026-05-01T11:10:00.000Z",
      blocked: false,
      blockReason: null,
    },
  ],
};

/** Document-approval variant with Google Docs integration evidence. */
export const mockDualSurfaceDocHistoryEvent = {
  eventId: "ds-doc-1",
  sequence: 1,
  type: "transition.completed" as const,
  fromState: "OPEN",
  toState: "PENDING_APPROVAL",
  transitionId: "dual_surface.document.submitted_for_approval.v1",
  actor: { id: "user:doc-1", type: "human" as const },
  evidence: {
    integration: {
      integrationConnectionId: INTEGRATION_GOOGLE_DOCS_CONNECTION_ID,
      integrationKind: "google_docs",
      googleDocumentId: "doc-abc",
      docContentSha256: "abc123",
      documentUrl: "https://docs.google.com/document/d/doc-abc/edit",
      decisionSignalId: "dual_surface.document.submitted_for_approval.v1",
    },
  },
  occurredAt: "2026-05-01T12:00:00.000Z",
  blocked: false,
  blockReason: null,
};

export const mockDualSurfaceRunEvidence: RunEvidenceReadResponse = {
  contractVersion: RUNTIME_API_CONTRACT_VERSION,
  loopRunId: DUAL_SURFACE_RUN_ID,
  loopId: DUAL_SURFACE_LOOP_ID,
  items: mockDualSurfaceRunHistory.events.map((e) => ({
    sequence: e.sequence,
    eventId: e.eventId,
    transitionId: e.transitionId,
    type: e.type,
    occurredAt: e.occurredAt,
    evidence: e.evidence,
  })),
};

export const mockDualSurfaceRunTimeline: RunTimelineReadResponse = {
  contractVersion: RUNTIME_API_CONTRACT_VERSION,
  loopRunId: DUAL_SURFACE_RUN_ID,
  timeline: {
    loopId: DUAL_SURFACE_LOOP_ID,
    instanceId: DUAL_SURFACE_RUN_ID,
    startedAt: "2026-05-01T11:00:00.000Z",
    completedAt: "2026-05-01T11:10:00.000Z",
    transitions: [],
    stateResidency: [],
  },
};

export const mockDualSurfaceRunReplaySummary: RunReplaySummaryReadResponse = {
  contractVersion: RUNTIME_API_CONTRACT_VERSION,
  loopRunId: DUAL_SURFACE_RUN_ID,
  loopId: DUAL_SURFACE_LOOP_ID,
  metrics: {
    loopId: DUAL_SURFACE_LOOP_ID,
    instanceId: DUAL_SURFACE_RUN_ID,
    totalDurationMs: 600_000,
    transitionCount: 3,
    guardBlockCount: 0,
    humanApprovalCount: 1,
    terminalState: "CLOSED",
    outcomeId: null,
  },
  transitionCount: 3,
  guardBlockCount: 0,
  humanApprovalCount: 1,
  terminalState: "CLOSED",
  sequenceValid: true,
  invalidAtSequence: null,
};

export const mockDualSurfaceRunBundle = {
  detail: mockDualSurfaceRunDetail,
  history: mockDualSurfaceRunHistory,
  evidence: mockDualSurfaceRunEvidence,
  timeline: mockDualSurfaceRunTimeline,
  replaySummary: mockDualSurfaceRunReplaySummary,
};
