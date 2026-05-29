// SPDX-License-Identifier: Apache-2.0
// Copyright © Loop Engine Contributors

import "./styles.css";

export type { StudioViewStatus, StudioStateFrameProps } from "./StudioStateFrame.js";
export { StudioStateFrame } from "./StudioStateFrame.js";

export type { RunSummaryCardProps } from "./RunSummaryCard.js";
export { RunSummaryCard, RunSummaryCardFromDetail } from "./RunSummaryCard.js";

export type { ActorAttributionProps } from "./ActorAttribution.js";
export { ActorAttribution } from "./ActorAttribution.js";

export type { GuardResult, GuardResultListProps } from "./GuardResultList.js";
export { GuardResultList } from "./GuardResultList.js";

export type { DualSurfaceEvidencePanelProps } from "./DualSurfaceEvidencePanel.js";
export { DualSurfaceEvidencePanel } from "./DualSurfaceEvidencePanel.js";

export {
  CHANNEL_SLACK_CONNECTION_ID,
  DUAL_SURFACE_LOOP_PREFIX,
  INTEGRATION_GOOGLE_DOCS_CONNECTION_ID,
  INTEGRATION_GOOGLE_SHEETS_CONNECTION_ID,
  isDualSurfaceLoop,
} from "./dual-surface/constants.js";
export {
  extractDualSurfaceEvidence,
  type DualSurfaceEvidenceExtract,
  type GoogleDocsIntegrationEvidenceView,
  type GoogleSheetsIntegrationEvidenceView,
  type SlackChannelEvidenceView,
} from "./dual-surface/extract-dual-surface-evidence.js";
export { slackWebClientPermalink } from "./dual-surface/slack-permalink.js";

export type { EvidencePanelProps } from "./EvidencePanel.js";
export { EvidencePanel, EvidencePanelFromResponse } from "./EvidencePanel.js";

export type { LoopTimelineProps } from "./LoopTimeline.js";
export { LoopTimeline } from "./LoopTimeline.js";

export type { ReplaySummaryPanelProps } from "./ReplaySummaryPanel.js";
export { ReplaySummaryPanel } from "./ReplaySummaryPanel.js";

export type { RunHistoryPanelProps } from "./RunHistoryPanel.js";
export { RunHistoryPanel, RunHistoryPanelFromResponse } from "./RunHistoryPanel.js";

export { StudioPrimitivesDemo } from "./StudioPrimitivesDemo.js";

export {
  mockRunDetail,
  mockRunEvidence,
  mockRunHistory,
  mockRunReplaySummary,
  mockRunTimeline,
  mockStudioRunBundle,
} from "./fixtures/mock-run.js";

export {
  DUAL_SURFACE_LOOP_ID,
  DUAL_SURFACE_RUN_ID,
  mockDualSurfaceRunBundle,
  mockDualSurfaceRunDetail,
  mockDualSurfaceRunEvidence,
  mockDualSurfaceRunHistory,
} from "./fixtures/mock-dual-surface-run.js";

export { formatDurationMs, formatIsoTimestamp, actorTypeLabel } from "./utils.js";

/** Re-export RT-05 DTO types for Studio hosts (single contract) */
export type {
  RunAuditEventDto,
  RunDetailReadResponse,
  RunEvidenceItemDto,
  RunEvidenceReadResponse,
  RunHistoryReadResponse,
  RunReadSummaryDto,
  RunReplaySummaryReadResponse,
  RunTimelineReadResponse,
  TraceLoopTimeline,
} from "@loop-engine/observability";
